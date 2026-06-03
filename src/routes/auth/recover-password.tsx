import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { AuthMarketingLayout } from "#/components/auth/auth-marketing-layout";
import {
  authAccentLinkClass,
  authFooterClass,
  authInputClassName,
  authLabelClass,
  authPageSpinnerClass,
  authPrimaryButtonClass,
} from "#/components/auth/auth-marketing-styles";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { APP_PATHS } from "#/lib/app-paths";
import { supabase } from "#/lib/supabase";

const schema = z
  .object({
    password: z.string().min(6, "At least 6 characters"),
    confirmPassword: z.string().min(6, "At least 6 characters"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

export const Route = createFileRoute("/auth/recover-password")({
  component: RecoverPassword,
});

function RecoverPassword() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"checking" | "ready" | "invalid">(
    "checking",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    let cancelled = false;
    const settled = { current: false };
    let fallbackId: number | undefined;
    let timeoutId: number | undefined;

    const markReady = () => {
      if (cancelled || settled.current) return;
      settled.current = true;
      if (fallbackId !== undefined) window.clearTimeout(fallbackId);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      setPhase("ready");
    };

    const markInvalid = () => {
      if (cancelled || settled.current) return;
      settled.current = true;
      if (fallbackId !== undefined) window.clearTimeout(fallbackId);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      setPhase("invalid");
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) markReady();
    });

    fallbackId = window.setTimeout(() => {
      void supabase.auth.getSession().then(({ data: { session } }) => {
        if (cancelled || settled.current) return;
        const hash = typeof window !== "undefined" ? window.location.hash : "";
        if (session?.user && hash.includes("type=recovery")) markReady();
      });
    }, 600);

    timeoutId = window.setTimeout(() => {
      if (cancelled || settled.current) return;
      markInvalid();
    }, 8000);

    return () => {
      cancelled = true;
      window.clearTimeout(fallbackId);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      sub.subscription.unsubscribe();
    };
  }, []);

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    setError(null);
    try {
      const { error: upd } = await supabase.auth.updateUser({
        password: values.password,
      });
      if (upd) throw upd;
      reset();
      await supabase.auth.signOut();
      navigate({ to: APP_PATHS.auth.login, search: { recovered: "1" } });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not update password.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthMarketingLayout
      heroTitle={
        <>
          Choose a new <br />
          <span className="italic text-(--auth-accent)">password</span>
        </>
      }
      heroDescription="Use a strong password you have not used elsewhere."
      heroTitleSize="compact"
      formTitle="Recover password"
      formDescription="Set a new password for your account."
    >
      {phase === "checking" && (
        <div className="flex min-h-[200px] items-center justify-center">
          <div className={authPageSpinnerClass()} />
        </div>
      )}

      {phase === "invalid" && (
        <div className="space-y-4 rounded-lg border border-amber-100 bg-amber-50/90 p-6 text-sm text-amber-950">
          <p>
            This link is invalid or has expired. Request a new reset email and
            open the link from the same browser when you are ready.
          </p>
          <Link to={APP_PATHS.auth.forgotPassword} className={authAccentLinkClass}>
            Request a new link
          </Link>
        </div>
      )}

      {phase === "ready" && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="password" className={authLabelClass}>
              New password
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              className={authInputClassName(!!errors.password)}
              {...register("password")}
            />
            {errors.password && (
              <p className="text-xs font-medium text-red-500">
                {errors.password.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className={authLabelClass}>
              Confirm password
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              className={authInputClassName(!!errors.confirmPassword)}
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p className="text-xs font-medium text-red-500">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={loading}
            className={authPrimaryButtonClass}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Updating…
              </span>
            ) : (
              "Update password"
            )}
          </Button>
        </form>
      )}

      <div className={authFooterClass}>
        <Link to={APP_PATHS.auth.login} className={authAccentLinkClass}>
          Back to sign in
        </Link>
      </div>
    </AuthMarketingLayout>
  );
}
