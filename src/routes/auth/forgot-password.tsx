import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { cn } from "../../lib/utils";
import { supabase } from "../../lib/supabase";
import sidebarImage from "../../assets/auth-sidebar.png";

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
      const redirectTo = `${window.location.origin}/auth/recover-password`;
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
    <div className="flex min-h-screen bg-[#F7F7F7]">
      <div className="relative hidden w-[60%] overflow-hidden lg:block">
        <img
          src={sidebarImage}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-tr from-[#0A1128]/90 to-[#0A1128]/20" />
        <div className="absolute inset-0 flex flex-col justify-end p-16 text-white">
          <h1 className="mb-6 font-serif text-5xl font-bold leading-tight">
            Reset with <br />
            <span className="italic text-[#FF6F61]">confidence</span>
          </h1>
          <p className="max-w-md text-lg font-light leading-relaxed text-gray-300">
            We will email you a secure link to choose a new password.
          </p>
        </div>
      </div>

      <div className="flex w-full flex-col justify-center px-8 lg:w-[40%] lg:px-20">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-10 text-center lg:text-left">
            <h2 className="text-3xl font-bold tracking-tight text-[#0A1128]">
              Forgot password
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Enter the email for your account. If it exists, you will receive a
              recovery link.
            </p>
          </div>

          {sent ? (
            <div className="space-y-6 rounded-lg border border-green-100 bg-green-50/80 p-6 text-sm text-green-900">
              <p>
                If an account exists for that address, we sent a reset link.
                Check your inbox and spam folder, then open the link on this
                device.
              </p>
              <Link
                to="/auth/login"
                className="inline-block font-semibold text-[#FF6F61] hover:underline"
              >
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
                <Label htmlFor="email" className="text-[#0A1128]">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
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

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-[#0A1128] py-6 text-white transition-all hover:bg-[#0A1128]/90"
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

          <div className="mt-8 text-center text-sm text-gray-500">
            <Link
              to="/auth/login"
              className="font-semibold text-[#FF6F61] hover:underline"
            >
              Return to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
