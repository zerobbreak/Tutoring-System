import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { requireAdminContext } from "#/lib/admin-server";
import { getSupabaseAdmin } from "#/lib/supabase-admin";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import {
  createWorkflowConversation,
  findWorkflowConversation,
  getOrCreateDirectConversation,
} from "./helpers";
import {
  buildMetadata,
  METADATA_CATEGORY,
  NOTICE_TYPES,
} from "./metadata-contract";

const PARTICIPANT_CHUNK = 50;

const searchSchema = z.object({
  query: z.string(),
  roles: z.array(z.enum(["TUTOR", "LECTURER"])).optional(),
});

const directSchema = z.object({
  targetUserId: z.string().uuid(),
});

const noticeSchema = z.object({
  noticeType: z.enum([
    NOTICE_TYPES.SYSTEM,
    NOTICE_TYPES.ACADEMIC,
    NOTICE_TYPES.PAYROLL,
    NOTICE_TYPES.ANNOUNCEMENT,
  ]),
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(10000),
});

const disputeIdSchema = z.object({
  disputeId: z.string().uuid(),
});

export type AdminMessagingUserDTO = {
  id: string;
  full_name: string;
  email: string;
  role: string;
};

export type AdminDisputeMessagingRowDTO = {
  id: string;
  reason: string;
  raised_at: string;
  claim_id: string;
  module_code: string;
  module_name: string;
  tutor_name: string;
};

async function loadInstitutionStaffIds(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  institutionId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq("institution_id", institutionId)
    .in("role", ["TUTOR", "LECTURER"]);

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.id as string);
}

async function insertParticipantsInChunks(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  conversationId: string,
  userIds: string[],
): Promise<void> {
  const unique = Array.from(new Set(userIds));
  for (let i = 0; i < unique.length; i += PARTICIPANT_CHUNK) {
    const chunk = unique.slice(i, i + PARTICIPANT_CHUNK);
    const { error } = await supabase.from("conversation_participants").insert(
      chunk.map((user_id) => ({
        conversation_id: conversationId,
        user_id,
      })),
    );
    if (error) throw new Error(error.message);
  }
}

async function ensureParticipant(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  conversationId: string,
  userId: string,
): Promise<void> {
  const { data } = await supabase
    .from("conversation_participants")
    .select("user_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (data) return;

  const { error } = await supabase.from("conversation_participants").insert({
    conversation_id: conversationId,
    user_id: userId,
  });
  if (error) throw new Error(error.message);
}

async function findDisputeConversationInstitution(
  institutionId: string,
  disputeId: string,
  claimId: string,
): Promise<string | null> {
  const service = getSupabaseAdmin();
  if (!service) return null;

  const { data: byDispute } = await service
    .from("conversations")
    .select("id")
    .eq("institution_id", institutionId)
    .eq("type", "CLAIM")
    .contains("metadata", {
      dispute_id: disputeId,
      category: METADATA_CATEGORY.CLAIM_DISPUTE,
    })
    .limit(1)
    .maybeSingle();

  if (byDispute?.id) return byDispute.id as string;

  const { data: byClaim } = await service
    .from("conversations")
    .select("id")
    .eq("institution_id", institutionId)
    .eq("type", "CLAIM")
    .contains("metadata", {
      claim_id: claimId,
      category: METADATA_CATEGORY.CLAIM_DISPUTE,
    })
    .limit(1)
    .maybeSingle();

  return (byClaim?.id as string) ?? null;
}

async function loadClaimParties(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  claimId: string,
) {
  const { data: claim, error } = await supabase
    .from("session_claims")
    .select(
      `
      id,
      tutor_id,
      module_id,
      module:modules ( id, lecturer_id, code, name )
    `,
    )
    .eq("id", claimId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!claim) throw new Error("Session claim not found.");

  const mod = Array.isArray(claim.module) ? claim.module[0] : claim.module;
  const lecturerId = mod?.lecturer_id as string | undefined;
  const tutorId = claim.tutor_id as string;

  if (!lecturerId) throw new Error("Module lecturer not found.");

  return {
    claimId: claim.id as string,
    tutorId,
    lecturerId,
    moduleId: claim.module_id as string,
    moduleCode: (mod?.code as string) ?? "Module",
  };
}

export const searchInstitutionUsersForAdminFn = createServerFn({
  method: "POST",
})
  .inputValidator((input: unknown) => searchSchema.parse(input))
  .handler(async ({ data }): Promise<AdminMessagingUserDTO[]> => {
    const supabase = createSupabaseServerClient();
    const { userId, institutionId } = await requireAdminContext(supabase);

    const roles = data.roles?.length
      ? data.roles
      : (["TUTOR", "LECTURER"] as const);

    const { data: rows, error } = await supabase
      .from("users")
      .select("id, full_name, email, role")
      .eq("institution_id", institutionId)
      .neq("id", userId)
      .in("role", [...roles])
      .or(`full_name.ilike.%${data.query}%,email.ilike.%${data.query}%`)
      .limit(15);

    if (error) throw new Error(error.message);
    return (rows ?? []) as AdminMessagingUserDTO[];
  });

export const createAdminDirectConversationFn = createServerFn({
  method: "POST",
})
  .inputValidator((input: unknown) => directSchema.parse(input))
  .handler(async ({ data }): Promise<{ conversationId: string }> => {
    const supabase = createSupabaseServerClient();
    const { userId, institutionId } = await requireAdminContext(supabase);

    const { data: target, error: tErr } = await supabase
      .from("users")
      .select("id, role")
      .eq("id", data.targetUserId)
      .eq("institution_id", institutionId)
      .maybeSingle();

    if (tErr) throw new Error(tErr.message);
    if (!target) throw new Error("User not found in your institution.");
    const role = target.role as string;
    if (role !== "TUTOR" && role !== "LECTURER") {
      throw new Error("You can only message tutors and lecturers.");
    }

    const metadata =
      role === "TUTOR"
        ? buildMetadata(METADATA_CATEGORY.ADMIN_NOTICE, {
            tutor_id: data.targetUserId,
            notice_type: NOTICE_TYPES.DIRECT,
          })
        : buildMetadata(METADATA_CATEGORY.ADMIN_NOTICE, {
            lecturer_id: data.targetUserId,
            notice_type: NOTICE_TYPES.DIRECT,
          });

    const conv = await getOrCreateDirectConversation(
      supabase,
      userId,
      data.targetUserId,
      institutionId,
      metadata,
    );

    return { conversationId: conv.id as string };
  });

export const createInstitutionNoticeFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => noticeSchema.parse(input))
  .handler(async ({ data }): Promise<{ conversationId: string }> => {
    const supabase = createSupabaseServerClient();
    const { userId, institutionId } = await requireAdminContext(supabase);

    const audienceIds = await loadInstitutionStaffIds(supabase, institutionId);
    if (!audienceIds.length) {
      throw new Error("No tutors or lecturers found in your institution.");
    }

    const metadata = buildMetadata(METADATA_CATEGORY.ADMIN_NOTICE, {
      notice_type: data.noticeType,
    });

    const conversationId = crypto.randomUUID();
    const title = data.title.trim();

    const { error: convError } = await supabase.from("conversations").insert({
      id: conversationId,
      type: "GROUP",
      title,
      metadata,
      institution_id: institutionId,
    });
    if (convError) throw new Error(convError.message);

    await insertParticipantsInChunks(supabase, conversationId, [
      userId,
      ...audienceIds,
    ]);

    const { error: msgError } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: userId,
      content: data.content.trim(),
      metadata: { notice_type: data.noticeType },
    });
    if (msgError) throw new Error(msgError.message);

    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);

    return { conversationId };
  });

export const listOpenDisputesForMessagingFn = createServerFn({
  method: "GET",
}).handler(async (): Promise<AdminDisputeMessagingRowDTO[]> => {
  const supabase = createSupabaseServerClient();
  const { institutionId } = await requireAdminContext(supabase);

  const { data: modules, error: mErr } = await supabase
    .from("modules")
    .select("id")
    .eq("institution_id", institutionId);

  if (mErr) throw new Error(mErr.message);
  const moduleIds = (modules ?? []).map((m) => m.id as string);
  if (!moduleIds.length) return [];

  const { data: claims, error: cErr } = await supabase
    .from("session_claims")
    .select("id, module_id, tutor_id")
    .in("module_id", moduleIds);

  if (cErr) throw new Error(cErr.message);
  const claimIds = (claims ?? []).map((c) => c.id as string);
  if (!claimIds.length) return [];

  const claimById = new Map((claims ?? []).map((c) => [c.id as string, c]));

  const { data: disputes, error: dErr } = await supabase
    .from("disputes")
    .select("id, reason, raised_at, claim_id")
    .eq("status", "OPEN")
    .in("claim_id", claimIds)
    .order("raised_at", { ascending: false });

  if (dErr) throw new Error(dErr.message);
  if (!disputes?.length) return [];

  const tutorIds = [
    ...new Set((claims ?? []).map((c) => c.tutor_id as string)),
  ];
  const { data: tutors } = await supabase
    .from("users")
    .select("id, full_name")
    .in("id", tutorIds);

  const tutorNameById = new Map(
    (tutors ?? []).map((t) => [t.id as string, t.full_name as string]),
  );

  const { data: moduleRows } = await supabase
    .from("modules")
    .select("id, code, name")
    .in("id", moduleIds);

  const moduleById = new Map(
    (moduleRows ?? []).map((m) => [
      m.id as string,
      { code: m.code as string, name: m.name as string },
    ]),
  );

  return (disputes ?? []).map((d) => {
    const claim = claimById.get(d.claim_id as string);
    const mod = claim ? moduleById.get(claim.module_id as string) : undefined;
    return {
      id: d.id as string,
      reason: d.reason as string,
      raised_at: d.raised_at as string,
      claim_id: d.claim_id as string,
      module_code: mod?.code ?? "",
      module_name: mod?.name ?? "",
      tutor_name: claim
        ? (tutorNameById.get(claim.tutor_id as string) ?? "Tutor")
        : "Tutor",
    };
  });
});

export const joinAdminDisputeConversationFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => disputeIdSchema.parse(input))
  .handler(async ({ data }): Promise<{ conversationId: string }> => {
    const supabase = createSupabaseServerClient();
    const { userId, institutionId } = await requireAdminContext(supabase);

    const { data: dispute, error: dErr } = await supabase
      .from("disputes")
      .select("id, claim_id")
      .eq("id", data.disputeId)
      .maybeSingle();

    if (dErr) throw new Error(dErr.message);
    if (!dispute) throw new Error("Dispute not found.");

    const parties = await loadClaimParties(
      supabase,
      dispute.claim_id as string,
    );

    const metadata = buildMetadata(METADATA_CATEGORY.CLAIM_DISPUTE, {
      claim_id: parties.claimId,
      dispute_id: dispute.id as string,
      module_id: parties.moduleId,
      tutor_id: parties.tutorId,
      lecturer_id: parties.lecturerId,
    });

    let conversationId =
      (await findWorkflowConversation(supabase, {
        userId,
        type: "CLAIM",
        metadataMatch: {
          claim_id: parties.claimId,
          dispute_id: dispute.id as string,
          category: METADATA_CATEGORY.CLAIM_DISPUTE,
        },
      })) ??
      (await findDisputeConversationInstitution(
        institutionId,
        dispute.id as string,
        parties.claimId,
      ));

    if (conversationId) {
      await ensureParticipant(supabase, conversationId, userId);
      return { conversationId };
    }

    conversationId = await createWorkflowConversation(supabase, {
      userId,
      institutionId,
      type: "CLAIM",
      title: `${parties.moduleCode} · Dispute`,
      metadata,
      participantIds: [parties.tutorId, parties.lecturerId],
    });

    return { conversationId };
  });
