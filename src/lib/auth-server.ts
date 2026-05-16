import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { ensurePublicUserProfile } from "./ensure-public-user";
import { createSupabaseServerClient } from "./supabase-server";
import { getSupabaseAdmin } from "./supabase-admin";
import { SELF_REGISTER_ROLES, type SelfRegisterRole } from "./user-role";

// Verification codes (server-side only). Keys match `user_role` enum values.
const VERIFICATION_CODES: Record<SelfRegisterRole, string> = {
  TUTOR: "T-4P7-R8",
  ADMIN: "A-1Z3-C5",
  LECTURER: "L-9X4-B2",
};

const selfRegisterRoleSchema = z.enum(SELF_REGISTER_ROLES);

const signUpInputSchema = z.object({
  email: z.email(),
  password: z.string().min(6),
  fullName: z.string().min(2),
  role: selfRegisterRoleSchema,
  verificationCode: z.string().optional(),
});

/**
 * Server Function to handle user registration
 */
export const signUpServerFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => signUpInputSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const { email, password, fullName, role, verificationCode } = data;

    // 1. Validate verification code for elevated roles (all self-register roles)
    if (verificationCode !== VERIFICATION_CODES[role]) {
      throw new Error(`Invalid verification code for the ${role} role.`);
    }

    // 2. Perform Supabase Sign Up
    const { data: authData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: role,
        },
      },
    });

    if (error) throw new Error(error.message);

    // 3. Sync public.users (trigger may run; upsert guarantees the row when possible)
    if (authData.user) {
      const admin = getSupabaseAdmin();
      if (admin) {
        await ensurePublicUserProfile(supabase, {
          full_name: fullName,
          role,
        });
      } else {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          await ensurePublicUserProfile(supabase, {
            full_name: fullName,
            role,
          });
        } else {
          throw new Error(
            "Account created but profile sync is pending. Confirm your email, then sign in. If the problem persists, set SUPABASE_SERVICE_ROLE_KEY on the server.",
          );
        }
      }
    }

    return {
      success: true,
      user: authData.user
        ? JSON.parse(JSON.stringify(authData.user))
        : null,
    };
  });

/**
 * Server Function: verified user + session snapshot for SSR / loaders.
 * Uses `getUser()` (JWT validated with Auth) then `getSession()` for token payload.
 */
export const getCurrentUserFn = createServerFn({ method: "GET" }).handler(
  async () => {
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
  .inputValidator((input: unknown) => updateProfileInputSchema.parse(input))
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
