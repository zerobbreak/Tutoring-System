import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Shield } from "lucide-react";
import * as z from "zod";
import {
  AuthMarketingLayout,
  AuthPageLoading,
} from "#/components/auth/auth-marketing-layout";
import {
  authAccentLinkClass,
  authFooterClass,
  authInputClassName,
  authLabelClass,
  authPrimaryButtonClass,
} from "#/components/auth/auth-marketing-styles";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { APP_PATHS } from "#/lib/app-paths";
import { getAuthUserLifecycleFn } from "#/lib/auth-server";
import {
  mfaDeviceLabel,
  needsMfaVerification,
  verifyMfaTotpCode,
} from "#/lib/mfa-auth";
import { supabase } from "#/lib/supabase";
import { toast } from "#/lib/toast";
import { getPostAuthDashboardPath, getUserRole } from "#/lib/user-role";
import { logSecurityEventFn } from "#/server-actions/settings";

const mfaSearchSchema = z.object({
  returnTo: z.string().optional(),
});

export const Route = createFileRoute("/auth/mfa")({
  validateSearch: mfaSearchSchema,
  component: MfaVerify,
});

const decodeURIComponentSafe = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

function MfaVerify() {
  const { returnTo } = Route.useSearch();
  const decodedReturnTo = returnTo ? decodeURIComponentSafe(returnTo) : undefined;
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [checking, setChecking] = useState(true);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (!user) {
        navigate({
          to: APP_PATHS.auth.login,
          replace: true,
          search: decodedReturnTo ? { returnTo: encodeURIComponent(decodedReturnTo) } : undefined,
        });
        return;
      }

      const pending = await needsMfaVerification();
      if (cancelled) return;

      if (!pending) {
        const role = getUserRole(user);
        const lifecycle = await getAuthUserLifecycleFn();
        const destination =
          lifecycle?.destination ?? getPostAuthDashboardPath(role);
        navigate({
          to: decodedReturnTo ?? destination,
          replace: true,
        });
        return;
      }

      setChecking(false);
    };

    void check();
    return () => {
      cancelled = true;
    };
  }, [navigate, returnTo]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length < 6) return;

    setSubmitting(true);
    try {
      const { ok, error } = await verifyMfaTotpCode(code);
      if (!ok) {
        toast.error(error ?? "Invalid verification code.");
        return;
      }

      await logSecurityEventFn({
        data: {
          eventType: "mfa_login",
          method: "totp",
          status: "success",
          deviceInfo: mfaDeviceLabel(),
        },
      });

      const {
        data: { user },
      } = await supabase.auth.getUser();
      const role = getUserRole(user);

      toast.success("Verification successful.");
      queryClient.clear();
      await router.invalidate();
      const lifecycle = await getAuthUserLifecycleFn();
      const destination =
        lifecycle?.destination ?? getPostAuthDashboardPath(role);
      await navigate({ to: decodedReturnTo ?? destination });
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Verification failed. Try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      queryClient.clear();
      await router.invalidate();
      await navigate({ to: APP_PATHS.auth.login });
    } finally {
      setSigningOut(false);
    }
  };

  if (checking) {
    return <AuthPageLoading />;
  }

  return (
    <AuthMarketingLayout
      heroBadge={
        <div className="flex size-14 items-center justify-center rounded-2xl bg-white/10">
          <Shield className="size-7 text-(--auth-accent)" />
        </div>
      }
      heroTitle={
        <>
          Secure <span className="italic text-(--auth-accent)">sign-in</span>
        </>
      }
      heroDescription="Your account is protected with two-factor authentication."
      heroTitleSize="compact"
      formTitle="Two-factor authentication"
      formDescription="Enter the 6-digit code from your authenticator app."
    >
      <form onSubmit={onSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="mfaCode" className={authLabelClass}>
            Authenticator code
          </Label>
          <Input
            id="mfaCode"
            name="otp"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="000000"
            maxLength={6}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            className={`${authInputClassName()} text-center text-lg tracking-[0.3em]`}
          />
        </div>

        <Button
          type="submit"
          disabled={submitting || code.trim().length < 6}
          className={authPrimaryButtonClass}
        >
          {submitting ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Verifying…
            </span>
          ) : (
            "Verify and continue"
          )}
        </Button>
      </form>

      <div className={authFooterClass}>
        <Link to={APP_PATHS.settings} className={`font-medium ${authAccentLinkClass}`}>
          Account settings
        </Link>
        {" · "}
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className={`font-medium ${authAccentLinkClass} disabled:opacity-50`}
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </AuthMarketingLayout>
  );
}
