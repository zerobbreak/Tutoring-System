import { createFileRoute, redirect } from "@tanstack/react-router";

import { getCurrentUserFn } from "../lib/auth-server";
import { getPostAuthDashboardPath } from "../lib/user-role";

export const Route = createFileRoute("/")({
  loader: async () => {
    const sessionData = await getCurrentUserFn();
    if (!sessionData?.user) {
      throw redirect({ to: "/auth/login" });
    }
    const role = sessionData.user.user_metadata?.role as string | undefined;
    throw redirect({ to: getPostAuthDashboardPath(role) });
  },
  component: () => null,
});
