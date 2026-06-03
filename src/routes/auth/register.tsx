import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
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
import { signUpServerFn } from "#/lib/auth-server";
import { toast } from "#/lib/toast";

const registerSchema = z
  .object({
    fullName: z.string().min(2, "Full name must be at least 2 characters"),
    email: z.email("Invalid email address"),
    inviteCode: z.string().min(1, "Invite code is required"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z
      .string()
      .min(6, "Password must be at least 6 characters"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

export const Route = createFileRoute("/auth/register")({
  component: Register,
});

function Register() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (values: RegisterFormValues) => {
    setLoading(true);

    try {
      await signUpServerFn({
        data: {
          email: values.email,
          password: values.password,
          fullName: values.fullName,
          inviteCode: values.inviteCode,
        },
      });

      toast.success("Account created", {
        description:
          "Check your email to confirm your address. You will be redirected to sign in.",
        duration: 5000,
      });
      setTimeout(() => navigate({ to: APP_PATHS.auth.login }), 4000);
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : "An unexpected error occurred during registration.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthMarketingLayout
      heroTitle={
        <>
          Begin Your <br />
          <span className="italic text-(--auth-accent)">Journey Today</span>
        </>
      }
      heroDescription="Use the invite code from your institution administrator to create your account."
      formTitle="Create Account"
      formDescription="Registration requires an email and invite code from your admin."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="fullName" className={authLabelClass}>
            Full Name
          </Label>
          <Input
            id="fullName"
            type="text"
            placeholder="John Doe"
            className={authInputClassName(!!errors.fullName)}
            {...register("fullName")}
          />
          {errors.fullName && (
            <p className="text-xs font-medium text-red-500">
              {errors.fullName.message}
            </p>
          )}
        </div>

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
          <Label htmlFor="inviteCode" className={authLabelClass}>
            Invite code
          </Label>
          <Input
            id="inviteCode"
            type="text"
            placeholder="XXXX-XXXX"
            autoComplete="off"
            className={authInputClassName(!!errors.inviteCode)}
            {...register("inviteCode")}
          />
          <p className="text-[10px] text-(--auth-muted-subtle)">
            Use the invite code from your institution administrator. It must
            match this email address.
          </p>
          {errors.inviteCode && (
            <p className="text-xs font-medium text-red-500">
              {errors.inviteCode.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className={authLabelClass}>
            Password
          </Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
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

        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className={authLabelClass}>
            Confirm Password
          </Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
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
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Creating account...
            </span>
          ) : (
            "Sign Up"
          )}
        </Button>
      </form>

      <div className={authFooterClass}>
        Already have an account?{" "}
        <Link to={APP_PATHS.auth.login} className={authAccentLinkClass}>
          Sign in
        </Link>
      </div>
    </AuthMarketingLayout>
  );
}
