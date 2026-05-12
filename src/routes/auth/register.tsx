import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { cn } from "../../lib/utils";
import sidebarImage from "../../assets/auth-sidebar.png";
import { signUpServerFn } from "../../lib/auth-server";
import { SELF_REGISTER_ROLES, formatRoleLabel } from "../../lib/user-role";

const registerSchema = z
  .object({
    fullName: z.string().min(2, "Full name must be at least 2 characters"),
    email: z.email("Invalid email address"),
    role: z.enum(SELF_REGISTER_ROLES),
    verificationCode: z.string().optional(),
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
  const [authError, setAuthError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: "TUTOR",
    },
  });

  const watchRole = watch("role");

  const onSubmit = async (values: RegisterFormValues) => {
    setLoading(true);
    setAuthError(null);
    setSuccessMessage(null);

    try {
      await signUpServerFn({
        data: {
          email: values.email,
          password: values.password,
          fullName: values.fullName,
          role: values.role,
          verificationCode: values.verificationCode,
        },
      });

      setSuccessMessage(
        "Registration successful! Please check your email for confirmation.",
      );
      setTimeout(() => navigate({ to: "/auth/login" }), 4000);
    } catch (error: any) {
      setAuthError(
        error.message || "An unexpected error occurred during registration.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F7F7F7]">
      {/* Left Column: Image/Branding */}
      <div className="hidden w-[60%] lg:block relative overflow-hidden">
        <img
          src={sidebarImage}
          alt="Knowledge and Learning"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-tr from-[#0A1128]/90 to-[#0A1128]/20" />
        <div className="absolute inset-0 flex flex-col justify-end p-16 text-white">
          <h1 className="text-6xl font-serif mb-6 leading-tight">
            Begin Your <br />
            <span className="italic text-[#FF6F61]">Journey Today</span>
          </h1>
          <p className="max-w-md text-lg text-gray-300 font-light leading-relaxed">
            Create an account and gain access to world-class tutoring. Your
            future starts with a single step.
          </p>
        </div>
      </div>

      {/* Right Column: Form */}
      <div className="flex w-full flex-col justify-center px-8 lg:w-[40%] lg:px-20">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-10 text-center lg:text-left">
            <h2 className="text-3xl font-bold tracking-tight text-[#0A1128]">
              Create Account
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Join our community and start learning now.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {authError && (
              <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700 animate-in fade-in slide-in-from-top-1">
                {authError}
              </div>
            )}
            {successMessage && (
              <div className="rounded-lg bg-green-50 p-4 text-sm text-green-700 animate-in fade-in slide-in-from-top-1">
                {successMessage}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-[#0A1128]">
                Full Name
              </Label>
              <Input
                id="fullName"
                type="text"
                placeholder="John Doe"
                className={cn(
                  "border-gray-200 focus:border-[#0A1128] focus:ring-[#0A1128]",
                  errors.fullName && "border-red-500 focus:ring-red-500",
                )}
                {...register("fullName")}
              />
              {errors.fullName && (
                <p className="text-xs font-medium text-red-500">
                  {errors.fullName.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="role" className="text-[#0A1128]">
                I am a...
              </Label>
              <select
                id="role"
                className={cn(
                  "w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[#0A1128] focus:outline-none focus:ring-1 focus:ring-[#0A1128]",
                  errors.role && "border-red-500",
                )}
                {...register("role")}
              >
                <option value="TUTOR">{formatRoleLabel("TUTOR")}</option>
                <option value="LECTURER">{formatRoleLabel("LECTURER")}</option>
                <option value="ADMIN">{formatRoleLabel("ADMIN")}</option>
              </select>
              {errors.role && (
                <p className="text-xs font-medium text-red-500">
                  {errors.role.message}
                </p>
              )}
            </div>

            {(watchRole === "LECTURER" ||
              watchRole === "TUTOR" ||
              watchRole === "ADMIN") && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <Label htmlFor="verificationCode" className="text-[#0A1128]">
                  {formatRoleLabel(watchRole)} access code
                </Label>
                <Input
                  id="verificationCode"
                  type="text"
                  placeholder="Enter secret code"
                  className={cn(
                    "border-gray-200 focus:border-[#0A1128] focus:ring-[#0A1128]",
                    errors.verificationCode &&
                      "border-red-500 focus:ring-red-500",
                  )}
                  {...register("verificationCode")}
                />
                <p className="text-[10px] text-gray-400">
                  Contact your administrator to receive your access code.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-[#0A1128]">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                className={cn(
                  "border-gray-200 focus:border-[#0A1128] focus:ring-[#0A1128]",
                  errors.email && "border-red-500 focus:ring-red-500",
                )}
                {...register("email")}
              />
              {errors.email && (
                <p className="text-xs font-medium text-red-500">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-[#0A1128]">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                className={cn(
                  "border-gray-200 focus:border-[#0A1128] focus:ring-[#0A1128]",
                  errors.password && "border-red-500 focus:ring-red-500",
                )}
                {...register("password")}
              />
              {errors.password && (
                <p className="text-xs font-medium text-red-500">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-[#0A1128]">
                Confirm Password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                className={cn(
                  "border-gray-200 focus:border-[#0A1128] focus:ring-[#0A1128]",
                  errors.confirmPassword && "border-red-500 focus:ring-red-500",
                )}
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
              className="w-full bg-[#0A1128] py-6 text-white hover:bg-[#0A1128]/90 transition-all duration-300 transform hover:scale-[1.02]"
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

          <div className="mt-8 text-center text-sm text-gray-500">
            Already have an account?{" "}
            <Link
              to="/auth/login"
              className="font-semibold text-[#FF6F61] hover:underline"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
