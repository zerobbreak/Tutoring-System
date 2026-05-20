import type { SupabaseClient } from "@supabase/supabase-js";
import { mfaDeviceLabel } from "#/lib/mfa-auth";

export async function getVerifiedTotpFactorId(
  supabase: SupabaseClient,
): Promise<string | null> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) return null;
  const verified = (data?.totp ?? []).find((f) => f.status === "verified");
  return verified?.id ?? null;
}

export async function userHasVerifiedTotp(
  supabase: SupabaseClient,
): Promise<boolean> {
  return (await getVerifiedTotpFactorId(supabase)) != null;
}

export async function verifyStepUpTotpOnServer(
  supabase: SupabaseClient,
  code: string,
): Promise<{ ok: boolean; error: string | null }> {
  const factorId = await getVerifiedTotpFactorId(supabase);
  if (!factorId) {
    return {
      ok: false,
      error:
        "Two-factor authentication is required. Set it up under Settings → Security before continuing.",
    };
  }

  const { data: challenge, error: challengeError } =
    await supabase.auth.mfa.challenge({ factorId });
  if (challengeError) {
    return { ok: false, error: challengeError.message };
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: code.trim(),
  });
  if (verifyError) {
    return { ok: false, error: verifyError.message };
  }

  return { ok: true, error: null };
}

export type StepUpMfaLogFn = (payload: {
  eventType: string;
  status: "success" | "failed";
}) => Promise<void>;

export async function requireStepUpMfa(
  supabase: SupabaseClient,
  code: string | undefined,
  actionLabel: string,
  logEvent?: StepUpMfaLogFn,
): Promise<void> {
  const hasTotp = await userHasVerifiedTotp(supabase);
  if (!hasTotp) {
    throw new Error(
      "Two-factor authentication is required. Set it up under Settings → Security before continuing.",
    );
  }

  if (!code?.trim()) {
    throw new Error(
      `Enter your authenticator code to confirm ${actionLabel}.`,
    );
  }

  const { ok, error } = await verifyStepUpTotpOnServer(supabase, code);
  if (!ok) {
    await logEvent?.({
      eventType: "mfa_step_up_failed",
      status: "failed",
    });
    throw new Error(error ?? "Invalid verification code.");
  }

  await logEvent?.({
    eventType: "mfa_step_up",
    status: "success",
  });
}

export function stepUpDeviceInfo(): string {
  return mfaDeviceLabel();
}
