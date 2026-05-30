import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { IncomingMessagesListener } from "#/components/messaging/incoming-messages-listener";
import { LecturerAppShell } from "#/components/lecturer-app-shell";
import { ScrollArea } from "#/components/ui/scroll-area";
import type { AppShellUser } from "#/components/app-shell";
import { gateAuthenticatedSession } from "#/lib/mfa-auth";
import { isLecturerDashboardRole } from "#/lib/user-role";
import { applyPlatformGate } from "#/lib/apply-platform-gate";

export const Route = createFileRoute("/lecturer")({
  component: LecturerLayout,
});

function LecturerLayout() {
  const [user, setUser] = useState<AppShellUser | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const gate = await gateAuthenticatedSession();
      if (gate.status === "unauthenticated") {
        navigate({ to: "/auth/login" });
        return;
      }
      if (gate.status === "mfa_required") {
        navigate({ to: "/auth/mfa" });
        return;
      }
      const u = gate.user;
      const role = u.user_metadata?.role as string | undefined;
      if (!isLecturerDashboardRole(role)) {
        navigate({ to: "/auth/login" });
        return;
      }
      const gateResult = await applyPlatformGate();
      if (!gateResult.allowed) {
        navigate({ to: gateResult.redirect });
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-(--lagoon-deep) border-t-transparent" />
      </div>
    );
  }

  return (
    <LecturerAppShell user={user}>
      <IncomingMessagesListener
        messagingPath="/lecturer/messages"
        conversationSearchParam
      />
      <ScrollArea className="min-h-0 flex-1">
        <Outlet />
      </ScrollArea>
    </LecturerAppShell>
  );
}
