import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { APP_PATHS } from "#/lib/app-paths";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { cn } from "../../lib/utils";
import { supabase } from "../../lib/supabase";
import sidebarImage from "../../assets/auth-sidebar.png";

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
            Choose a new <br />
            <span className="italic text-[#FF6F61]">password</span>
          </h1>
          <p className="max-w-md text-lg font-light leading-relaxed text-gray-300">
            Use a strong password you have not used elsewhere.
          </p>
        </div>
      </div>

      <div className="flex w-full flex-col justify-center px-8 lg:w-[40%] lg:px-20">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-10 text-center lg:text-left">
            <h2 className="text-3xl font-bold tracking-tight text-[#0A1128]">
              Recover password
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Set a new password for your account.
            </p>
          </div>

          {phase === "checking" && (
            <div className="flex min-h-[200px] items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0A1128] border-t-transparent" />
            </div>
          )}

          {phase === "invalid" && (
            <div className="space-y-4 rounded-lg border border-amber-100 bg-amber-50/90 p-6 text-sm text-amber-950">
              <p>
                This link is invalid or has expired. Request a new reset email
                and open the link from the same browser when you are ready.
              </p>
              <Link
                to={APP_PATHS.auth.forgotPassword}
                className="font-semibold text-[#FF6F61] hover:underline"
              >
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
                <Label htmlFor="password" className="text-[#0A1128]">
                  New password
                </Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
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
                  Confirm password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
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
                className="w-full bg-[#0A1128] py-6 text-white transition-all hover:bg-[#0A1128]/90"
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

          <div className="mt-8 text-center text-sm text-gray-500">
            <Link
              to={APP_PATHS.auth.login}
              className="font-semibold text-[#FF6F61] hover:underline"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
