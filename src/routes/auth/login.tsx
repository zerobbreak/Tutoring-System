import { createFileRoute, useNavigate, useRouter, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
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
import { getAuthUserLifecycleFn } from "#/lib/auth-server";
import { needsMfaVerification } from "#/lib/mfa-auth";
import { supabase } from "#/lib/supabase";
import { toast } from "#/lib/toast";
import { getPostAuthDashboardPath, getUserRole } from "#/lib/user-role";

const loginSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const loginSearchSchema = z.object({
  recovered: z.literal("1").optional(),
  returnTo: z.string().optional(),
});

export const Route = createFileRoute("/auth/login")({
  validateSearch: loginSearchSchema,
  component: Login,
});

const decodeURIComponentSafe = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

function Login() {
  const { recovered, returnTo } = Route.useSearch();
  const decodedReturnTo = returnTo ? decodeURIComponentSafe(returnTo) : undefined;
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (values: LoginFormValues) => {
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (error) {
        toast.error(error.message || "Invalid email or password.");
        return;
      }

      if (!data.user) {
        toast.error("Sign in did not return a user. Try again.");
        return;
      }

      if (!data.session) {
        toast.error(
          "No active session (e.g. email not confirmed). Check your inbox or reset your password.",
        );
        return;
      }

      if (await needsMfaVerification()) {
        toast.success("Enter your authenticator code to continue.");
        queryClient.clear();
        await router.invalidate();
        await navigate({
          to: APP_PATHS.auth.mfa,
          search: decodedReturnTo ? { returnTo: encodeURIComponent(decodedReturnTo) } : undefined,
        });
        return;
      }

      const role = getUserRole(data.user);
      toast.success("Signed in successfully.");
      queryClient.clear();
      await router.invalidate();
      const lifecycle = await getAuthUserLifecycleFn();
      const destination =
        lifecycle?.destination ?? getPostAuthDashboardPath(role);
      await navigate({
        to: decodedReturnTo ?? destination,
      });
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Invalid email or password.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthMarketingLayout
      heroTitle={
        <>
          Unlock the Power <br />
          <span className="italic text-(--auth-accent)">of Knowledge</span>
        </>
      }
      heroDescription="Join our community of lifelong learners and expert tutors. Personalized education designed for your future."
      formTitle="Welcome Back"
      formDescription="Please enter your credentials to access your dashboard."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {recovered === "1" && (
          <div className="rounded-lg border border-green-100 bg-green-50 p-4 text-sm text-green-800">
            Your password was updated. Sign in with your new password.
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="email" className={authLabelClass}>
            Email Address
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

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className={authLabelClass}>
              Password
            </Label>
            <Link
              to={APP_PATHS.auth.forgotPassword}
              className={`text-xs ${authAccentLinkClass}`}
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            className={authInputClassName(!!errors.password)}
            {...register("password")}
          />
          {errors.password && (
            <p className="text-xs font-medium text-red-500">
              {errors.password.message}
            </p>
          )}
        </div>

        <Button
          type="submit"
          disabled={loading}
          className={authPrimaryButtonClass}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Signing in...
            </span>
          ) : (
            "Sign In"
          )}
        </Button>
      </form>

      <div className={authFooterClass}>
        Have an invite code?{" "}
        <Link to={APP_PATHS.auth.register} className={authAccentLinkClass}>
          Create account
        </Link>
      </div>
    </AuthMarketingLayout>
  );
}
