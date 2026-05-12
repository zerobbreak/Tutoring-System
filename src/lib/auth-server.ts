import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { supabase } from "./supabase";
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

    // 3. Populate the public.users table
    if (authData.user) {
      const { error: dbError } = await supabase.from("users").insert({
        id: authData.user.id,
        email: email,
        full_name: fullName,
        role: role,
      });

      if (dbError) {
        console.error("Server-side DB insertion error:", dbError);
      }
    }

    return {
      success: true,
      user: authData.user
        ? JSON.parse(JSON.stringify(authData.user))
        : null,
    };
  });

const signInInputSchema = z.object({
  email: z.email(),
  password: z.string().min(6),
});

/**
 * Server Function to handle user login
 */
export const signInServerFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => signInInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { email, password } = data;

    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw new Error(error.message);

    const userPOJO = authData.user
      ? JSON.parse(JSON.stringify(authData.user))
      : null;

    return {
      success: true,
      user: userPOJO,
      session: authData.session
        ? {
            access_token: authData.session.access_token,
            refresh_token: authData.session.refresh_token,
            expires_at: authData.session.expires_at,
            user: userPOJO,
          }
        : null,
    };
  });

/**
 * Server Function to get current user session (SSR friendly)
 */
export const getCurrentUserFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session) return null;

    const userPOJO = JSON.parse(JSON.stringify(session.user));

    // Return a POJO that mimics the Supabase Session structure but is safe for serialization
    return {
      user: userPOJO,
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
        user: userPOJO,
      },
    };
  });

const updateProfileInputSchema = z.object({
  fullName: z.string().min(1),
});

/**
 * Server Function to update user profile
 */
export const updateProfileServerFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => updateProfileInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { fullName } = data;

    // 1. Get current session
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();
    if (authError || !session) throw new Error("Unauthorized");

    // 2. Update Auth metadata
    const { error: updateError } = await supabase.auth.updateUser({
      data: { full_name: fullName },
    });
    if (updateError) throw new Error(updateError.message);

    // 3. Update public.users table
    const { error: dbError } = await supabase
      .from("users")
      .update({ full_name: fullName })
      .eq("id", session.user.id);

    if (dbError) {
      console.error("Server-side profile sync error:", dbError);
    }

    return { success: true };
  });
