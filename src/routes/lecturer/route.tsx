import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { IncomingMessagesListener } from "#/components/messaging/incoming-messages-listener";
import { LecturerAppShell } from "#/components/lecturer-app-shell";
import type { AppShellUser } from "#/components/app-shell";
import { supabase } from "#/lib/supabase";
import { isLecturerDashboardRole } from "#/lib/user-role";
import { fetchUserApprovalAllowed } from "#/lib/user-approval-gate";

export const Route = createFileRoute("/lecturer")({
  component: LecturerLayout,
});

function LecturerLayout() {
  const [user, setUser] = useState<AppShellUser | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user: u },
      } = await supabase.auth.getUser();
      const role = u?.user_metadata?.role as string | undefined;
      if (!u || !isLecturerDashboardRole(role)) {
        navigate({ to: "/auth/login" });
        return;
      }
      const allowed = await fetchUserApprovalAllowed();
      if (!allowed) {
        navigate({ to: "/settings" });
        return;
      }
      setUser(u);
      setLoading(false);
    };
    void checkAuth();
  }, [navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--lagoon-deep)] border-t-transparent" />
      </div>
    );
  }

  return (
    <LecturerAppShell user={user}>
      <IncomingMessagesListener
        messagingPath="/lecturer/messages"
        conversationSearchParam
      />
      <Outlet />
    </LecturerAppShell>
  );
}
