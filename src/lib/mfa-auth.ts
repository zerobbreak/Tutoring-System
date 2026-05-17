import { supabase } from "#/lib/supabase";

type AalLevels = {
  currentLevel: string | null;
  nextLevel: string | null;
};

export function mfaDeviceLabel(): string {
  if (typeof navigator === "undefined") return "Unknown device";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return "Apple mobile";
  if (/Android/.test(ua)) return "Android device";
  if (/Mac/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows PC";
  if (/Linux/.test(ua)) return "Linux";
  return "Web browser";
}

export function needsMfaVerificationFromAal(
  aal: AalLevels | null | undefined,
): boolean {
  if (!aal) return false;
  return aal.nextLevel === "aal2" && aal.currentLevel !== "aal2";
}

/** True when the user has MFA enrolled but has not verified it this session. */
export async function needsMfaVerification(): Promise<boolean> {
  const { data, error } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) return false;
  return needsMfaVerificationFromAal(data);
}

export async function getPrimaryTotpFactorId(): Promise<string | null> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) return null;
  const verified = (data?.totp ?? []).find((f) => f.status === "verified");
  return verified?.id ?? data?.totp?.[0]?.id ?? null;
}

export async function verifyMfaTotpCode(code: string): Promise<{
  ok: boolean;
  error: string | null;
}> {
  const factorId = await getPrimaryTotpFactorId();
  if (!factorId) {
    return {
      ok: false,
      error: "No authenticator is set up for this account.",
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

export type AuthGateResult =
  | { status: "unauthenticated" }
  | { status: "mfa_required" }
  | { status: "ready"; user: NonNullable<Awaited<ReturnType<typeof getGateUser>>> };

async function getGateUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Used by dashboard layouts: login redirect, MFA redirect, or proceed. */
export async function gateAuthenticatedSession(): Promise<AuthGateResult> {
  const user = await getGateUser();
  if (!user) return { status: "unauthenticated" };
  if (await needsMfaVerification()) return { status: "mfa_required" };
  return { status: "ready", user };
}
