import { createServerFn } from "@tanstack/react-start";
import { requireAdminContext } from "#/lib/admin-server";
import { getSupabaseAdmin } from "#/lib/supabase-admin";
import { createSupabaseServerClient } from "#/lib/supabase-server";

export type RegistrationInviteRowDTO = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  expires_at: string;
  created_at: string;
};

export const listRegistrationInvitesFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ invites: RegistrationInviteRowDTO[] }> => {
    const supabase = createSupabaseServerClient();
    const ctx = await requireAdminContext(supabase);

    const admin = getSupabaseAdmin();
    if (!admin) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY is required to list registration invites.",
      );
    }

    const now = new Date().toISOString();

    const { data: rows, error } = await admin
      .from("user_registration_invites")
      .select("id, email, full_name, role, expires_at, created_at")
      .eq("institution_id", ctx.institutionId)
      .is("used_at", null)
      .is("revoked_at", null)
      .gt("expires_at", now)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    const invites: RegistrationInviteRowDTO[] = (rows ?? []).map((row) => ({
      id: row.id as string,
      email: row.email as string,
      full_name: (row.full_name as string | null) ?? null,
      role: row.role as string,
      expires_at: row.expires_at as string,
      created_at: row.created_at as string,
    }));

    return { invites };
  },
);
