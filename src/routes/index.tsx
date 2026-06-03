import { createFileRoute, redirect } from "@tanstack/react-router";
import { APP_PATHS } from "#/lib/app-paths";
import { getAuthUserLifecycleFn, getCurrentUserFn } from "../lib/auth-server";
import { getPostAuthDashboardPath, getUserRole } from "../lib/user-role";

export const Route = createFileRoute("/")({
  loader: async () => {
    const sessionData = await getCurrentUserFn();
    if (!sessionData?.user) {
      throw redirect({ to: APP_PATHS.auth.login });
    }
    const role = getUserRole(sessionData.user);
    const lifecycle = await getAuthUserLifecycleFn();
    const destination =
      lifecycle?.destination ?? getPostAuthDashboardPath(role);
    throw redirect({ to: destination });
  },
  component: () => null,
});
