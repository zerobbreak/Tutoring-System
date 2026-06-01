import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldOff } from "lucide-react";
import { Button } from "#/components/ui/button";
import sidebarImage from "#/assets/auth-sidebar.png";
import { APP_PATHS } from "#/lib/app-paths";
import { supabase } from "#/lib/supabase";
import { fetchAuthUserLifecycleClient } from "#/lib/user-platform-gate";
import { formatUserStatus, hasPlatformAccess } from "#/lib/user-status";

export const Route = createFileRoute("/auth/account-blocked")({
  component: AccountBlockedPage,
});

function AccountBlockedPage() {
  const navigate = useNavigate();
  const [statusLabel, setStatusLabel] = useState("Unavailable");
  const [detail, setDetail] = useState<string>(
    "Your account cannot access the platform. Contact your institution administrator.",
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (!user) {
        navigate({ to: APP_PATHS.auth.login, replace: true });
        return;
      }

      const lifecycle = await fetchAuthUserLifecycleClient();
      if (cancelled) return;

      if (!lifecycle || hasPlatformAccess(lifecycle.user_status)) {
        navigate({ to: APP_PATHS.settings, replace: true });
        return;
      }

      setStatusLabel(formatUserStatus(lifecycle.user_status));
      if (lifecycle.user_status === "REJECTED") {
        setDetail(
          "Your onboarding application was rejected. You cannot use tutor, lecturer, or admin features. Contact your institution if you believe this is an error.",
        );
      } else if (lifecycle.user_status === "SUSPENDED") {
        setDetail(
          "Your account has been suspended by an administrator. Platform access is disabled until your institution restores your account.",
        );
      }
      setLoading(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: APP_PATHS.auth.login, replace: true });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F7F7]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0A1128] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F7F7F7]">
      <div className="relative hidden w-[60%] overflow-hidden lg:block">
        <img
          src={sidebarImage}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-tr from-[#0A1128]/90 to-[#0A1128]/20" />
      </div>
      <div className="flex w-full flex-col justify-center px-8 lg:w-[40%] lg:px-20">
        <div className="mx-auto w-full max-w-sm text-center">
          <ShieldOff className="mx-auto size-12 text-amber-700" />
          <h1 className="mt-4 text-2xl font-bold text-[#0A1128]">
            Account {statusLabel}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-gray-600">{detail}</p>
          <div className="mt-8 flex flex-col gap-3">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => void signOut()}
            >
              Sign out
            </Button>
            <Button asChild variant="ghost" className="w-full">
              <Link to={APP_PATHS.settings}>Account settings</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
