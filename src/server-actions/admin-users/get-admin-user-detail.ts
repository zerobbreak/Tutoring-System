import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminContext } from "#/lib/admin-server";
import { getSupabaseAdmin } from "#/lib/supabase-admin";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import type { OnboardingDocumentKind } from "#/lib/onboarding-documents";
import { assertTargetUserInInstitution } from "./assert-target-user";
import type {
  AdminUserDetailDTO,
  AdminUserDocumentDTO,
  AdminUserRowDTO,
} from "./types";

const idSchema = z.object({ userId: z.string().uuid() });

export const getAdminUserDetailFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => idSchema.parse(input))
  .handler(async ({ data }): Promise<AdminUserDetailDTO> => {
    const supabase = createSupabaseServerClient();
    const ctx = await requireAdminContext(supabase);
    await assertTargetUserInInstitution(supabase, ctx, data.userId);

    const admin = getSupabaseAdmin();
    const db = admin ?? supabase;

    const [userRes, docsRes, modulesRes, assignmentsRes] = await Promise.all([
      db
        .from("users")
        .select(
          "id, full_name, email, role, institution_id, last_login_at, user_status, onboarding_step, approval_status, mfa_enabled, is_active, can_unlock_venues, created_at, institutions(name)",
        )
        .eq("id", data.userId)
        .single(),
      db
        .from("user_onboarding_documents")
        .select(
          "id, document_kind, file_name, mime_type, storage_path, submitted_at",
        )
        .eq("user_id", data.userId)
        .order("submitted_at", { ascending: true }),
      db
        .from("modules")
        .select("id, code, name")
        .eq("lecturer_id", data.userId)
        .eq("institution_id", ctx.institutionId)
        .order("code", { ascending: true }),
      db
        .from("tutor_assignments")
        .select("id", { count: "exact", head: true })
        .eq("tutor_id", data.userId)
        .eq("is_active", true),
    ]);

    if (userRes.error) throw new Error(userRes.error.message);

    const row = userRes.data;
    const inst = row.institutions as { name: string } | { name: string }[] | null;
    const institutionName = Array.isArray(inst)
      ? inst[0]?.name ?? null
      : inst?.name ?? null;

    const user: AdminUserRowDTO = {
      id: row.id as string,
      full_name: row.full_name as string,
      email: row.email as string,
      role: row.role as AdminUserRowDTO["role"],
      institution_id: row.institution_id as string | null,
      institution_name: institutionName,
      last_login_at: row.last_login_at as string | null,
      user_status: row.user_status as string,
      onboarding_step: (row.onboarding_step as string | null) ?? null,
      approval_status: row.approval_status as string,
      mfa_enabled: Boolean(row.mfa_enabled),
      can_unlock_venues: Boolean(row.can_unlock_venues),
      is_active: Boolean(row.is_active),
      created_at: row.created_at as string,
    };

    const documents: AdminUserDocumentDTO[] = await Promise.all(
      (docsRes.data ?? []).map(async (doc) => {
        let download_url: string | null = null;
        const { data: signed } = await db.storage
          .from("onboarding-documents")
          .createSignedUrl(doc.storage_path as string, 3600);
        download_url = signed?.signedUrl ?? null;

        return {
          id: doc.id as string,
          document_kind: doc.document_kind as OnboardingDocumentKind,
          file_name: doc.file_name as string,
          mime_type: doc.mime_type as string,
          storage_path: doc.storage_path as string,
          submitted_at: doc.submitted_at as string,
          download_url,
        };
      }),
    );

    return {
      user,
      documents,
      modules_as_lecturer: (modulesRes.data ?? []).map((m) => ({
        id: m.id as string,
        code: m.code as string,
        name: m.name as string,
      })),
      active_tutor_assignments: assignmentsRes.count ?? 0,
    };
  });
