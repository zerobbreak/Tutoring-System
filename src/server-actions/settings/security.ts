import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { ensurePublicUserProfile } from "#/lib/ensure-public-user";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { getSupabaseAdmin } from "#/lib/supabase-admin";
import { requireUserId } from "./require-user";

export const syncMfaEnabledFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ enabled: z.boolean() }).parse(input),
  )
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const userId = await requireUserId(supabase);

    await ensurePublicUserProfile(supabase);

    const admin = getSupabaseAdmin();
    const db = admin ?? supabase;

    const { error } = await db
      .from("users")
      .update({ mfa_enabled: data.enabled })
      .eq("id", userId);
    if (error) throw new Error(error.message);

    await db.from("mfa_events").insert({
      user_id: userId,
      event_type: data.enabled ? "mfa_enabled" : "mfa_disabled",
      method: "totp",
      status: "success",
      device_info: "Settings page",
    });

    return { success: true };
  });

export const logSecurityEventFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        eventType: z.string().min(1),
        method: z.string().min(1),
        status: z.string().min(1),
        deviceInfo: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const userId = await requireUserId(supabase);

    const admin = getSupabaseAdmin();
    const db = admin ?? supabase;

    await db.from("mfa_events").insert({
      user_id: userId,
      event_type: data.eventType,
      method: data.method,
      status: data.status,
      device_info: data.deviceInfo ?? null,
    });

    return { success: true };
  });

export const requestPasswordResetFn = createServerFn({ method: "POST" }).handler(
  async () => {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) throw new Error("Unauthorized");

    const { error } = await supabase.auth.resetPasswordForEmail(user.email);
    if (error) throw new Error(error.message);

    return { success: true, email: user.email };
  },
);
