import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserRole } from "#/lib/user-role";
import { ACTIVE_LIFECYCLE, PENDING_LIFECYCLE } from "#/lib/user-status";

export type ProvisionInstitutionUserInput = {
  email: string;
  fullName: string;
  role: UserRole;
  institutionId: string;
  temporaryPassword?: string;
  /** When true, user is immediately ACTIVE; otherwise PENDING_APPROVAL. */
  skipOnboarding?: boolean;
};

export type ProvisionInstitutionUserResult = {
  userId: string;
  created: boolean;
  /** Set when a new password was generated or explicitly provided for a new user. */
  temporaryPassword?: string;
};

const PROVISIONABLE_ROLES = new Set<UserRole>([
  "TUTOR",
  "LECTURER",
  "ADMIN",
  "SUPER_ADMIN",
]);

function defaultTemporaryPassword(): string {
  return crypto.randomUUID().slice(0, 16) + "Aa1!";
}

/**
 * Creates or re-links an auth user + public.users row for an institution.
 * Uses the Supabase service-role client.
 */
export async function provisionInstitutionUser(
  admin: SupabaseClient,
  input: ProvisionInstitutionUserInput,
): Promise<ProvisionInstitutionUserResult> {
  const role = input.role;
  if (!PROVISIONABLE_ROLES.has(role)) {
    throw new Error(`Cannot provision accounts with role ${role}.`);
  }

  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  const lifecycle = input.skipOnboarding ? ACTIVE_LIFECYCLE : PENDING_LIFECYCLE;

  const { data: existingUser } = await admin
    .from("users")
    .select("id, role, institution_id")
    .eq("email", email)
    .maybeSingle();

  if (existingUser?.id) {
    if (existingUser.role !== role) {
      throw new Error(
        `This email is already registered with role ${existingUser.role as string}.`,
      );
    }

    if (
      existingUser.institution_id &&
      existingUser.institution_id !== input.institutionId
    ) {
      throw new Error(
        "This user belongs to a different institution and cannot be provisioned here.",
      );
    }

    const userId = existingUser.id as string;

    const { error: updErr } = await admin
      .from("users")
      .update({
        full_name: fullName,
        institution_id: input.institutionId,
        ...lifecycle,
      })
      .eq("id", userId);

    if (updErr) throw new Error(updErr.message);

    const { error: metaErr } = await admin.auth.admin.updateUserById(userId, {
      user_metadata: { full_name: fullName, role },
    });
    if (metaErr) throw new Error(metaErr.message);

    return { userId, created: false };
  }

  const password =
    input.temporaryPassword?.trim() || defaultTemporaryPassword();

  const { data: authUser, error: authErr } = await admin.auth.admin.createUser(
    {
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role,
      },
    },
  );

  if (authErr) throw new Error(authErr.message);
  if (!authUser.user?.id) {
    throw new Error("Auth user was not created.");
  }

  const userId = authUser.user.id;

  const { error: profileErr } = await admin.from("users").upsert(
    {
      id: userId,
      email,
      full_name: fullName,
      role,
      institution_id: input.institutionId,
      ...lifecycle,
    },
    { onConflict: "id" },
  );

  if (profileErr) throw new Error(profileErr.message);

  return {
    userId,
    created: true,
    temporaryPassword: password,
  };
}
