import type { User } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "#/lib/supabase-admin";
import type { createSupabaseServerClient } from "#/lib/supabase-server";

const VALID_ROLES = new Set(["TUTOR", "LECTURER", "ADMIN"]);

export type PublicUserProfile = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  institution_id: string | null;
};

function roleFromAuth(user: User): string {
  const meta = user.user_metadata ?? {};
  const raw = (meta.role as string | undefined) ?? "TUTOR";
  return VALID_ROLES.has(raw) ? raw : "TUTOR";
}

const LAST_LOGIN_THROTTLE_MS = 60 * 60 * 1000;

async function touchLastLoginAt(
  db: ReturnType<typeof createSupabaseServerClient>,
  userId: string,
): Promise<void> {
  const { data: row } = await db
    .from("users")
    .select("last_login_at")
    .eq("id", userId)
    .maybeSingle();

  const last = row?.last_login_at
    ? new Date(row.last_login_at as string).getTime()
    : 0;
  if (Date.now() - last < LAST_LOGIN_THROTTLE_MS) return;

  await db
    .from("users")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", userId);
}

function fullNameFromAuth(user: User): string {
  const meta = user.user_metadata ?? {};
  const name = meta.full_name as string | undefined;
  if (name?.trim()) return name.trim();
  if (user.email) return user.email.split("@")[0] ?? "User";
  return "User";
}

/**
 * Ensures a row exists in public.users for the current auth session.
 * Uses service role when available (required for reliable upsert when the row is missing).
 */
export async function ensurePublicUserProfile(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  patch?: Partial<
    Pick<PublicUserProfile, "full_name" | "role" | "institution_id">
  >,
): Promise<PublicUserProfile> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Unauthorized");

  const admin = getSupabaseAdmin();

  let existing: {
    full_name?: string;
    role?: string;
    institution_id?: string | null;
  } | null = null;

  if (admin) {
    const { data } = await admin
      .from("users")
      .select("full_name, role, institution_id")
      .eq("id", user.id)
      .maybeSingle();
    existing = data;
  } else {
    const { data } = await supabase
      .from("users")
      .select("full_name, role, institution_id")
      .eq("id", user.id)
      .maybeSingle();
    existing = data;
  }

  const row = {
    id: user.id,
    email: user.email ?? "",
    full_name: patch?.full_name ?? existing?.full_name ?? fullNameFromAuth(user),
    role: patch?.role ?? existing?.role ?? roleFromAuth(user),
    institution_id:
      patch?.institution_id !== undefined
        ? patch.institution_id
        : (existing?.institution_id as string | null) ?? null,
  };

  if (!VALID_ROLES.has(row.role)) {
    row.role = roleFromAuth(user);
  }

  const db = admin ?? supabase;
  const { data: saved, error: upsertError } = await db
    .from("users")
    .upsert(row, { onConflict: "id" })
    .select("id, email, full_name, role, institution_id")
    .single();

  if (upsertError) {
    if (!admin) {
      throw new Error(
        `Profile could not be saved: ${upsertError.message}. Add SUPABASE_SERVICE_ROLE_KEY to your server environment for reliable profile sync.`,
      );
    }
    throw new Error(`Profile could not be saved: ${upsertError.message}`);
  }

  await touchLastLoginAt(db, user.id);

  return {
    id: saved.id as string,
    email: saved.email as string,
    full_name: saved.full_name as string,
    role: saved.role as string,
    institution_id: (saved.institution_id as string | null) ?? null,
  };
}
