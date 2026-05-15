import { useCallback, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  KeyRound,
  Loader2,
  Monitor,
  Shield,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Link } from "@tanstack/react-router";
import { Button } from "#/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { Separator } from "#/components/ui/separator";
import { supabase } from "#/lib/supabase";
import { toast } from "#/lib/toast";
import type { SettingsProfileDTO } from "#/server-actions/settings";
import {
  logSecurityEventFn,
  requestPasswordResetFn,
  syncMfaEnabledFn,
} from "#/server-actions/settings";

type SecuritySettingsProps = {
  profile: SettingsProfileDTO;
  onProfileChange: (profile: SettingsProfileDTO) => void;
  onRefresh: () => Promise<void>;
};

function deviceLabel(): string {
  if (typeof navigator === "undefined") return "Unknown device";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return "Apple mobile";
  if (/Android/.test(ua)) return "Android device";
  if (/Mac/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows PC";
  if (/Linux/.test(ua)) return "Linux";
  return "Web browser";
}

export function SecuritySettings({
  profile,
  onProfileChange,
  onRefresh,
}: SecuritySettingsProps) {
  const [mfaFactors, setMfaFactors] = useState<
    { id: string; friendly_name?: string; factor_type: string }[]
  >([]);
  const [mfaLoading, setMfaLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollSecret, setEnrollSecret] = useState<string | null>(null);
  const [enrollFactorId, setEnrollFactorId] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [resetSending, setResetSending] = useState(false);
  const [signingOutAll, setSigningOutAll] = useState(false);

  const loadFactors = useCallback(async () => {
    setMfaLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      const totp = data?.totp ?? [];
      setMfaFactors(totp);
    } catch {
      setMfaFactors([]);
    } finally {
      setMfaLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFactors();
  }, [loadFactors]);

  const mfaActive = mfaFactors.length > 0 || profile.mfa_enabled;

  const handleStartMfa = async () => {
    setEnrolling(true);
    setEnrollSecret(null);
    setEnrollFactorId(null);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Authenticator app",
      });
      if (error) throw error;
      setEnrollSecret(data.totp.secret);
      setEnrollFactorId(data.id);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Could not start MFA enrollment.",
      );
    } finally {
      setEnrolling(false);
    }
  };

  const handleVerifyMfa = async () => {
    if (!enrollFactorId || !verifyCode.trim()) return;
    try {
      const { data: challenge, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId: enrollFactorId });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: enrollFactorId,
        challengeId: challenge.id,
        code: verifyCode.trim(),
      });
      if (verifyError) throw verifyError;

      await syncMfaEnabledFn({ data: { enabled: true } });
      await logSecurityEventFn({
        data: {
          eventType: "mfa_enrolled",
          method: "totp",
          status: "success",
          deviceInfo: deviceLabel(),
        },
      });
      onProfileChange({ ...profile, mfa_enabled: true });
      setEnrollSecret(null);
      setEnrollFactorId(null);
      setVerifyCode("");
      await loadFactors();
      await onRefresh();
      toast.success("Two-factor authentication is enabled.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Invalid verification code.");
    }
  };

  const handleDisableMfa = async (factorId: string) => {
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
      await syncMfaEnabledFn({ data: { enabled: false } });
      await logSecurityEventFn({
        data: {
          eventType: "mfa_unenrolled",
          method: "totp",
          status: "success",
          deviceInfo: deviceLabel(),
        },
      });
      onProfileChange({ ...profile, mfa_enabled: false });
      await loadFactors();
      await onRefresh();
      toast.success("Two-factor authentication disabled.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not disable MFA.");
    }
  };

  const handlePasswordReset = async () => {
    setResetSending(true);
    try {
      const result = await requestPasswordResetFn();
      toast.success(`Password reset link sent to ${result.email}.`);
      await logSecurityEventFn({
        data: {
          eventType: "password_reset_requested",
          method: "email",
          status: "success",
        },
      });
      await onRefresh();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to send reset email.",
      );
    } finally {
      setResetSending(false);
    }
  };

  const handleSignOutAll = async () => {
    setSigningOutAll(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: "global" });
      if (error) throw error;
      toast.success("Signed out on all devices.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Sign out failed.");
    } finally {
      setSigningOutAll(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="size-4 text-[var(--lagoon)]" />
            Multi-factor authentication
          </CardTitle>
          <CardDescription>
            Add an authenticator app for an extra layer of security.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg border px-4 py-3">
            {mfaActive ? (
              <ShieldCheck className="size-5 text-emerald-600" />
            ) : (
              <Smartphone className="size-5 text-muted-foreground" />
            )}
            <div>
              <p className="font-medium text-[#0A1128]">
                {mfaLoading
                  ? "Checking status…"
                  : mfaActive
                    ? "MFA is enabled"
                    : "MFA is not enabled"}
              </p>
              <p className="text-sm text-muted-foreground">
                TOTP via Google Authenticator, Authy, or similar apps.
              </p>
            </div>
          </div>

          {!mfaActive && !enrollSecret ? (
            <Button
              type="button"
              onClick={handleStartMfa}
              disabled={enrolling || mfaLoading}
              className="bg-[var(--lagoon)] text-white hover:bg-[var(--lagoon-deep)]"
            >
              {enrolling ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Preparing…
                </>
              ) : (
                "Set up MFA"
              )}
            </Button>
          ) : null}

          {enrollSecret && enrollFactorId ? (
            <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground">
                Scan this QR code with your authenticator app, then enter the
                6-digit code.
              </p>
              <div className="flex justify-center rounded-lg bg-white p-4">
                <QRCodeSVG
                  value={`otpauth://totp/TutoringSystem:${encodeURIComponent(profile.email)}?secret=${enrollSecret}&issuer=TutoringSystem`}
                  size={160}
                />
              </div>
              <p className="break-all text-center font-mono text-xs text-muted-foreground">
                {enrollSecret}
              </p>
              <div className="space-y-2">
                <Label htmlFor="mfaCode">Verification code</Label>
                <Input
                  id="mfaCode"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value)}
                  placeholder="000000"
                  maxLength={6}
                  inputMode="numeric"
                />
                <Button
                  type="button"
                  onClick={handleVerifyMfa}
                  disabled={verifyCode.length < 6}
                  className="bg-[var(--lagoon)] text-white hover:bg-[var(--lagoon-deep)]"
                >
                  Verify and enable
                </Button>
              </div>
            </div>
          ) : null}

          {mfaFactors.map((factor) => (
            <div
              key={factor.id}
              className="flex items-center justify-between rounded-lg border px-4 py-3"
            >
              <span className="text-sm font-medium">
                {factor.friendly_name ?? "Authenticator app"}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleDisableMfa(factor.id)}
              >
                Remove
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-4 text-[var(--lagoon)]" />
            Password
          </CardTitle>
          <CardDescription>
            Reset your password via a secure email link.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={resetSending}
            onClick={handlePasswordReset}
          >
            {resetSending ? "Sending…" : "Send password reset email"}
          </Button>
          <Button type="button" variant="ghost" asChild>
            <Link to="/auth/forgot-password">Forgot password page</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="size-4 text-[var(--lagoon)]" />
            Device management
          </CardTitle>
          <CardDescription>
            Sessions and devices connected to your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border px-4 py-3">
            <p className="font-medium text-[#0A1128]">This device</p>
            <p className="text-sm text-muted-foreground">{deviceLabel()}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Signed in as {profile.email}
            </p>
          </div>
          <Button
            type="button"
            variant="destructive"
            disabled={signingOutAll}
            onClick={handleSignOutAll}
          >
            {signingOutAll ? "Signing out…" : "Sign out all devices"}
          </Button>
          <Separator />
          <p className="text-sm font-medium text-[#0A1128]">Recent activity</p>
          {profile.security_events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No security events yet.</p>
          ) : (
            <ul className="space-y-2">
              {profile.security_events.map((ev) => (
                <li
                  key={ev.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <span className="capitalize">
                    {ev.event_type.replace(/_/g, " ")} · {ev.method}
                  </span>
                  <span className="text-muted-foreground">
                    {format(parseISO(ev.occurred_at), "MMM d, yyyy HH:mm")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
