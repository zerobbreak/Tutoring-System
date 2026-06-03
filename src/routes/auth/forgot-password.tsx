import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { AuthMarketingLayout } from "#/components/auth/auth-marketing-layout";
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
import { supabase } from "#/lib/supabase";

const schema = z.object({
  email: z.email("Invalid email address"),
});

type FormValues = z.infer<typeof schema>;

export const Route = createFileRoute("/auth/forgot-password")({
  component: ForgotPassword,
});

function ForgotPassword() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    setError(null);
    try {
      const redirectTo = `${window.location.origin}${APP_PATHS.auth.recoverPassword}`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        values.email,
        { redirectTo },
      );
      if (resetError) throw resetError;
      setSent(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthMarketingLayout
      heroTitle={
        <>
          Reset with <br />
          <span className="italic text-(--auth-accent)">confidence</span>
        </>
      }
      heroDescription="We will email you a secure link to choose a new password."
      heroTitleSize="compact"
      formTitle="Forgot password"
      formDescription="Enter the email for your account. If it exists, you will receive a recovery link."
    >
      {sent ? (
        <div className="space-y-6 rounded-lg border border-green-100 bg-green-50/80 p-6 text-sm text-green-900">
          <p>
            If an account exists for that address, we sent a reset link. Check
            your inbox and spam folder, then open the link on this device.
          </p>
          <Link to={APP_PATHS.auth.login} className={authAccentLinkClass}>
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className={authLabelClass}>
              Email
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              className={authInputClassName(!!errors.email)}
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs font-medium text-red-500">
                {errors.email.message}
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
                Sending…
              </span>
            ) : (
              "Send reset link"
            )}
          </Button>
        </form>
      )}

      <div className={authFooterClass}>
        <Link to={APP_PATHS.auth.login} className={authAccentLinkClass}>
          Return to sign in
        </Link>
      </div>
    </AuthMarketingLayout>
  );
}
