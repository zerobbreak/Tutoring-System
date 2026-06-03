import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldOff } from "lucide-react";
import {
  AuthMarketingLayout,
  AuthPageLoading,
} from "#/components/auth/auth-marketing-layout";
import { authMutedClass } from "#/components/auth/auth-marketing-styles";
import { Button } from "#/components/ui/button";
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
    return <AuthPageLoading />;
  }

  return (
    <AuthMarketingLayout>
      <div className="text-center">
        <ShieldOff className="mx-auto size-12 text-amber-700" />
        <h1 className="mt-4 text-2xl font-bold text-(--auth-ink)">
          Account {statusLabel}
        </h1>
        <p className={`mt-3 text-sm leading-relaxed ${authMutedClass}`}>{detail}</p>
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
    </AuthMarketingLayout>
  );
}
