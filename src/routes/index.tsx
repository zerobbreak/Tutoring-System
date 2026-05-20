import { createFileRoute, redirect } from "@tanstack/react-router";

import { getAuthUserLifecycleFn, getCurrentUserFn } from "../lib/auth-server";
import { getPostAuthDashboardPath } from "../lib/user-role";

export const Route = createFileRoute("/")({
  loader: async () => {
    const sessionData = await getCurrentUserFn();
    if (!sessionData?.user) {
      throw redirect({ to: "/auth/login" });
    }
    const role = sessionData.user.user_metadata?.role as string | undefined;
    const lifecycle = await getAuthUserLifecycleFn();
    const destination =
      lifecycle?.destination ?? getPostAuthDashboardPath(role);
    throw redirect({ to: destination });
  },
  component: () => null,
});
