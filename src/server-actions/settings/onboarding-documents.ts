import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ensurePublicUserProfile } from "#/lib/ensure-public-user";
import {
  ONBOARDING_DOCUMENT_KINDS,
  type OnboardingDocumentKind,
} from "#/lib/onboarding-documents";
import { createSupabaseServerClient } from "#/lib/supabase-server";

async function requireUserId(
  supabase: ReturnType<typeof createSupabaseServerClient>,
): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");
  return user.id;
}

export type OnboardingDocumentDTO = {
  id: string;
  document_kind: OnboardingDocumentKind;
  file_name: string;
  submitted_at: string;
};

export type OnboardingStatusDTO = {
  approval_status: string;
  institution_id: string | null;
  documents: OnboardingDocumentDTO[];
  required_kinds: OnboardingDocumentKind[];
  missing_kinds: OnboardingDocumentKind[];
};

export const getOnboardingStatusFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<OnboardingStatusDTO> => {
    const supabase = createSupabaseServerClient();
    const userId = await requireUserId(supabase);
    await ensurePublicUserProfile(supabase);

    const [userRes, docsRes] = await Promise.all([
      supabase
        .from("users")
        .select("approval_status, institution_id")
        .eq("id", userId)
        .single(),
      supabase
        .from("user_onboarding_documents")
        .select("id, document_kind, file_name, submitted_at")
        .eq("user_id", userId)
        .order("submitted_at", { ascending: true }),
    ]);

    if (userRes.error) throw new Error(userRes.error.message);

    const documents = (docsRes.data ?? []) as OnboardingDocumentDTO[];
    const submittedKinds = new Set(
      documents.map((d) => d.document_kind as OnboardingDocumentKind),
    );
    const missing_kinds = ONBOARDING_DOCUMENT_KINDS.filter(
      (k) => !submittedKinds.has(k),
    );

    return {
      approval_status: (userRes.data?.approval_status as string) ?? "pending_documents",
      institution_id: (userRes.data?.institution_id as string | null) ?? null,
      documents,
      required_kinds: [...ONBOARDING_DOCUMENT_KINDS],
      missing_kinds,
    };
  },
);

const uploadSchema = z.object({
  documentKind: z.enum(ONBOARDING_DOCUMENT_KINDS),
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(100),
  fileBase64: z.string().min(1),
});

export const uploadOnboardingDocumentFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => uploadSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const userId = await requireUserId(supabase);
    await ensurePublicUserProfile(supabase);

    const { data: userRow, error: userErr } = await supabase
      .from("users")
      .select("institution_id, approval_status")
      .eq("id", userId)
      .single();

    if (userErr) throw new Error(userErr.message);
    const institutionId = userRow?.institution_id as string | null;
    if (!institutionId) {
      throw new Error(
        "Link your institution in account settings before uploading documents.",
      );
    }

    const status = userRow?.approval_status as string;
    if (status === "approved") {
      throw new Error("Your account is already approved.");
    }
    if (status === "rejected") {
      throw new Error(
        "Your application was rejected. Contact your institution administrator.",
      );
    }

    const buf = Buffer.from(data.fileBase64, "base64");
    if (buf.byteLength > 10 * 1024 * 1024) {
      throw new Error("File must be under 10 MB.");
    }

    const safeName = data.fileName.replace(/[^\w.\-]+/g, "_").slice(0, 200);
    const storagePath = `${userId}/${data.documentKind}/${Date.now()}_${safeName}`;

    const { error: uploadErr } = await supabase.storage
      .from("onboarding-documents")
      .upload(storagePath, buf, {
        upsert: true,
        contentType: data.contentType,
      });
    if (uploadErr) throw new Error(uploadErr.message);

    const { error: docErr } = await supabase
      .from("user_onboarding_documents")
      .upsert(
        {
          user_id: userId,
          institution_id: institutionId,
          document_kind: data.documentKind,
          storage_path: storagePath,
          file_name: data.fileName,
          mime_type: data.contentType,
        },
        { onConflict: "user_id,document_kind" },
      );

    if (docErr) throw new Error(docErr.message);

    const { data: allDocs } = await supabase
      .from("user_onboarding_documents")
      .select("document_kind")
      .eq("user_id", userId);

    const kinds = new Set((allDocs ?? []).map((d) => d.document_kind));
    const allPresent = ONBOARDING_DOCUMENT_KINDS.every((k) => kinds.has(k));

    if (allPresent) {
      const { error: statusErr } = await supabase
        .from("users")
        .update({ approval_status: "pending_review" })
        .eq("id", userId);
      if (statusErr) throw new Error(statusErr.message);
    }

    return { ok: true as const, pendingReview: allPresent };
  });
