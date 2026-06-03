import { Link } from "@tanstack/react-router";
import type { AppShellUser } from "#/components/app-shell";
import { UserNav } from "#/components/user-nav";
import { APP_PATHS } from "#/lib/app-paths";
import type { DashboardPath } from "#/lib/app-paths";

type RootPublicNavProps = {
  sessionUser: AppShellUser | null;
  brandTo: DashboardPath | typeof APP_PATHS.auth.login;
};

export function RootPublicNav({ sessionUser, brandTo }: RootPublicNavProps) {
  return (
    <nav className="border-b border-border bg-card px-4 py-3 shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <Link
          to={brandTo}
          className="text-xl font-bold text-(--lagoon-deep)"
        >
          Tutoring System
        </Link>
        <div className="flex items-center gap-4">
          {sessionUser ? (
            <UserNav user={sessionUser} />
          ) : (
            <>
              <Link
                to={APP_PATHS.auth.login}
                className="text-sm font-medium text-muted-foreground hover:text-(--lagoon-deep)"
              >
                Login
              </Link>
              <Link
                to={APP_PATHS.auth.register}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
