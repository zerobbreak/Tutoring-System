import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { ensurePublicUserProfile } from "./ensure-public-user";
import {
  inviteCodeMatches,
  normalizeInviteEmail,
} from "./registration-invite-code";
import { createSupabaseServerClient } from "./supabase-server";
import { getSupabaseAdmin } from "./supabase-admin";
import { PENDING_LIFECYCLE } from "./user-status";
import { fetchAuthUserLifecycle } from "./user-lifecycle-server";
import { getPostAuthDestination, getUserRole } from "./user-role";
import type { RootSessionData } from "./root-session";

const signUpInputSchema = z.object({
  email: z.email(),
  password: z.string().min(6),
  fullName: z.string().min(2),
  inviteCode: z.string().min(1),
});

type ActiveInviteRow = {
  id: string;
  institution_id: string;
  email: string;
  full_name: string | null;
  role: string;
  code_hash: string;
};

async function findMatchingInvite(
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  email: string,
  inviteCode: string,
): Promise<ActiveInviteRow | null> {
  const now = new Date().toISOString();

  const { data: rows, error } = await admin
    .from("user_registration_invites")
    .select(
      "id, institution_id, email, full_name, role, code_hash",
    )
    .eq("email", email)
    .is("used_at", null)
    .is("revoked_at", null)
    .gt("expires_at", now);

  if (error) throw new Error(error.message);

  for (const row of rows ?? []) {
    if (inviteCodeMatches(row.code_hash as string, inviteCode)) {
      return row as ActiveInviteRow;
    }
  }

  return null;
}

/**
 * Server Function to handle user registration via admin-issued invite code.
 */
export const signUpServerFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => signUpInputSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const admin = getSupabaseAdmin();

    if (!admin) {
      throw new Error(
        "Registration is unavailable: server configuration is incomplete. Contact your administrator.",
      );
    }

    const email = normalizeInviteEmail(data.email);
    const fullName = data.fullName.trim();
    const { password, inviteCode } = data;

    const invite = await findMatchingInvite(admin, email, inviteCode);
    if (!invite) {
      throw new Error(
        "Invalid or expired invite code for this email. Contact your administrator.",
      );
    }

    const role = invite.role;

    const { data: existingUser } = await admin
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingUser?.id) {
      throw new Error(
        "An account with this email already exists. Sign in instead.",
      );
    }

    const { data: authData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role,
        },
      },
    });

    if (error) throw new Error(error.message);

    if (!authData.user?.id) {
      throw new Error("Account could not be created.");
    }

    const userId = authData.user.id;

    const { error: profileErr } = await admin.from("users").upsert(
      {
        id: userId,
        email,
        full_name: fullName,
        role,
        institution_id: invite.institution_id,
        ...PENDING_LIFECYCLE,
      },
      { onConflict: "id" },
    );

    if (profileErr) throw new Error(profileErr.message);

    const now = new Date().toISOString();
    const { error: inviteErr } = await admin
      .from("user_registration_invites")
      .update({ used_at: now, used_by: userId })
      .eq("id", invite.id)
      .is("used_at", null);

    if (inviteErr) throw new Error(inviteErr.message);

    return {
      success: true,
      user: JSON.parse(JSON.stringify(authData.user)),
    };
  });

/**
 * Server Function: verified user + session snapshot for SSR / loaders.
 * Uses `getUser()` (JWT validated with Auth) then `getSession()` for token payload.
 */
/** Lifecycle snapshot for post-login routing (client-safe path). */
export const getAuthUserLifecycleFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) return null;

    const lifecycle = await fetchAuthUserLifecycle(supabase, user.id);
    if (!lifecycle) return null;

    const role = getUserRole(user);
    return {
      ...lifecycle,
      destination: getPostAuthDestination(role, lifecycle.user_status),
    };
  },
);

export const getCurrentUserFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<RootSessionData | null> => {
    const supabase = createSupabaseServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) return null;

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) return null;

    try {
      await ensurePublicUserProfile(supabase);
    } catch (syncError) {
      console.error("public.users sync on session load:", syncError);
    }

    const userPOJO = JSON.parse(JSON.stringify(session.user));

    return {
      user: userPOJO,
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
        user: userPOJO,
      },
    };
  },
);

const updateProfileInputSchema = z.object({
  fullName: z.string().min(1),
});

/**
 * Server Function to update user profile
 */
export const updateProfileServerFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => updateProfileInputSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const { fullName } = data;

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { error: updateError } = await supabase.auth.updateUser({
      data: { full_name: fullName },
    });
    if (updateError) throw new Error(updateError.message);

    await ensurePublicUserProfile(supabase, { full_name: fullName });

    return { success: true };
  });
