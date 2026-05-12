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
import { signInServerFn } from "../../lib/auth-server";

const loginSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export const Route = createFileRoute("/auth/login")({
  component: Login,
});

function Login() {
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });


  const onSubmit = async (values: LoginFormValues) => {
    setLoading(true);
    setAuthError(null);

    try {
      const result = await signInServerFn({
        data: {
          email: values.email,
          password: values.password,
        },
      });

      if (result.user) {
        const role = result.user.user_metadata?.role;
        if (role === "admin" || role === "lecturer") {
          navigate({ to: "/admin" });
        } else if (role === "tutor") {
          navigate({ to: "/tutor" });
        } else {
          navigate({ to: "/" });
        }
      }
    } catch (error: any) {
      setAuthError(error.message || "Invalid email or password.");
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
        <div className="absolute inset-0 bg-gradient-to-tr from-[#0A1128]/90 to-[#0A1128]/20" />
        <div className="absolute inset-0 flex flex-col justify-end p-16 text-white">
          <h1 className="text-6xl font-serif mb-6 leading-tight">
            Unlock the Power <br />
            <span className="italic text-[#FF6F61]">of Knowledge</span>
          </h1>
          <p className="max-w-md text-lg text-gray-300 font-light leading-relaxed">
            Join our community of lifelong learners and expert tutors.
            Personalized education designed for your future.
          </p>
        </div>
      </div>

      {/* Right Column: Form */}
      <div className="flex w-full flex-col justify-center px-8 lg:w-[40%] lg:px-20">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-10 text-center lg:text-left">
            <h2 className="text-3xl font-bold tracking-tight text-[#0A1128]">
              Welcome Back
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Please enter your credentials to access your dashboard.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {authError && (
              <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700 animate-in fade-in slide-in-from-top-1">
                {authError}
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
              <div className="flex items-center justify-between">
                <Label htmlFor="password text-[#0A1128]">Password</Label>
                <a href="#" className="text-xs text-[#FF6F61] hover:underline">
                  Forgot password?
                </a>
              </div>
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

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0A1128] py-6 text-white hover:bg-[#0A1128]/90 transition-all duration-300 transform hover:scale-[1.02]"
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

          <div className="mt-8 text-center text-sm text-gray-500">
            Don't have an account?{" "}
            <Link
              to="/auth/register"
              className="font-semibold text-[#FF6F61] hover:underline"
            >
              Join us today
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
