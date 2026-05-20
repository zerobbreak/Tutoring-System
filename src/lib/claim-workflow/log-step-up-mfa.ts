import type { SupabaseClient } from "@supabase/supabase-js";
import { stepUpDeviceInfo } from "#/lib/mfa-auth-server";
import type { StepUpMfaLogFn } from "#/lib/mfa-auth-server";

export function createStepUpMfaLogger(
  supabase: SupabaseClient,
  userId: string,
): StepUpMfaLogFn {
  return async ({ eventType, status }) => {
    await supabase.from("mfa_events").insert({
      user_id: userId,
      event_type: eventType,
      method: "totp",
      status,
      device_info: stepUpDeviceInfo(),
    });
  };
}
