import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Shield } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import sidebarImage from "#/assets/auth-sidebar.png";
import { supabase } from "#/lib/supabase";
import { toast } from "#/lib/toast";
import {
  mfaDeviceLabel,
  needsMfaVerification,
  verifyMfaTotpCode,
} from "#/lib/mfa-auth";
import { getAuthUserLifecycleFn } from "#/lib/auth-server";
import { APP_PATHS } from "#/lib/app-paths";
import { getPostAuthDashboardPath } from "#/lib/user-role";
import { logSecurityEventFn } from "#/server-actions/settings";

export const Route = createFileRoute("/auth/mfa")({
  component: MfaVerify,
});

function MfaVerify() {
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
        navigate({ to: APP_PATHS.auth.login, replace: true });
        return;
      }

      const pending = await needsMfaVerification();
      if (cancelled) return;

      if (!pending) {
        const role = user.user_metadata?.role as string | undefined;
        const lifecycle = await getAuthUserLifecycleFn();
        const destination =
          lifecycle?.destination ?? getPostAuthDashboardPath(role);
        navigate({ to: destination, replace: true });
        return;
      }

      setChecking(false);
    };

    void check();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

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
      const role = user?.user_metadata?.role as string | undefined;

      toast.success("Verification successful.");
      queryClient.clear();
      await router.invalidate();
      const lifecycle = await getAuthUserLifecycleFn();
      const destination =
        lifecycle?.destination ?? getPostAuthDashboardPath(role);
      await navigate({ to: destination });
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
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F7F7]">
        <span className="h-8 w-8 animate-spin rounded-full border-4 border-[#0A1128] border-t-transparent" />
      </div>
    );
  }

  return (
    <AuthPageShell>
      <MfaSidebar />
      <MfaFormPanel
        code={code}
        setCode={setCode}
        submitting={submitting}
        signingOut={signingOut}
        onSubmit={onSubmit}
        onSignOut={handleSignOut}
      />
    </AuthPageShell>
  );
}

function AuthPageShell({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen bg-[#F7F7F7]">{children}</div>;
}

function MfaSidebar() {
  return (
    <div className="hidden w-[60%] lg:block relative overflow-hidden">
      <img
        src={sidebarImage}
        alt="Knowledge and Learning"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-linear-to-tr from-[#0A1128]/90 to-[#0A1128]/20" />
      <div className="absolute inset-0 flex flex-col justify-end p-16 text-white">
        <div className="mb-6 flex size-14 items-center justify-center rounded-2xl bg-white/10">
          <Shield className="size-7 text-[#FF6F61]" />
        </div>
        <h1 className="text-5xl font-serif mb-4 leading-tight">
          Secure <span className="italic text-[#FF6F61]">sign-in</span>
        </h1>
        <p className="max-w-md text-lg text-gray-300 font-light leading-relaxed">
          Your account is protected with two-factor authentication.
        </p>
      </div>
    </div>
  );
}

function MfaFormPanel({
  code,
  setCode,
  submitting,
  signingOut,
  onSubmit,
  onSignOut,
}: {
  code: string;
  setCode: (value: string) => void;
  submitting: boolean;
  signingOut: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onSignOut: () => void;
}) {
  return (
    <div className="flex w-full flex-col justify-center px-8 lg:w-[40%] lg:px-20">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-10 text-center lg:text-left">
          <h2 className="text-3xl font-bold tracking-tight text-[#0A1128]">
            Two-factor authentication
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            Enter the 6-digit code from your authenticator app.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="mfaCode" className="text-[#0A1128]">
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
              className="border-gray-200 text-center text-lg tracking-[0.3em] focus:border-[#0A1128] focus:ring-[#0A1128]"
            />
          </div>

          <Button
            type="submit"
            disabled={submitting || code.trim().length < 6}
            className="w-full bg-[#0A1128] py-6 text-white hover:bg-[#0A1128]/90 transition-all duration-300 transform hover:scale-[1.02]"
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

        <div className="mt-8 text-center text-sm text-gray-500">
        <Link
            to={APP_PATHS.settings}
            className="font-medium text-[#FF6F61] hover:underline"
          >
            Account settings
          </Link>
          {" · "}
          <button
            type="button"
            onClick={onSignOut}
            disabled={signingOut}
            className="font-medium text-[#FF6F61] hover:underline disabled:opacity-50"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>
    </div>
  );
}
