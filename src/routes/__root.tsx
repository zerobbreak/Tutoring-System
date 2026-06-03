import {
  HeadContent,
  Link,
  Scripts,
  createRootRouteWithContext,
  useLocation,
} from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { RootPublicNav } from "#/components/root-public-nav";
import { Toaster } from "#/components/ui/sonner";
import { getCurrentUserFn } from "#/lib/auth-server";
import { APP_PATHS } from "#/lib/app-paths";
import type { RootLoaderData } from "#/lib/root-session";
import { resolveRootShellLayout } from "#/lib/root-shell-layout";
import { useRootAuthSync } from "#/lib/use-root-auth-sync";
import { getPostAuthDashboardPath, getUserRole } from "#/lib/user-role";

import appCss from "../styles.css?url";

const AppDevtools = import.meta.env.DEV
  ? lazy(() =>
      import("#/components/app-devtools").then((m) => ({
        default: m.AppDevtools,
      })),
    )
  : null;

export type RouterContext = {
  queryClient: QueryClient;
};

export const Route = createRootRouteWithContext<RouterContext>()({
  loader: async (): Promise<RootLoaderData> => {
    try {
      const sessionData = await getCurrentUserFn();
      return { sessionData };
    } catch {
      return { sessionData: null };
    }
  },
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Tutoring System",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: () => (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <h1 className="text-2xl font-bold">404 - Not Found</h1>
      <p className="mt-2 text-muted-foreground">
        The page you are looking for does not exist.
      </p>
      <Link
        to={APP_PATHS.auth.login}
        className="mt-4 text-primary hover:underline"
      >
        Go to sign in
      </Link>
    </div>
  ),
});

function RootDocument({ children }: { children: React.ReactNode }) {
  const { sessionData } = Route.useLoaderData();
  const sessionUser = useRootAuthSync(sessionData);
  const { pathname } = useLocation();
  const layout = resolveRootShellLayout(pathname);

  const brandTo = sessionUser
    ? getPostAuthDashboardPath(getUserRole(sessionUser))
    : APP_PATHS.auth.login;

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className={`bg-background ${layout.bodyClassName}`}>
        {layout.showPublicNav ? (
          <RootPublicNav sessionUser={sessionUser} brandTo={brandTo} />
        ) : null}
        <main className={layout.mainClassName}>{children}</main>
        <Toaster richColors closeButton />
        {AppDevtools ? (
          <Suspense fallback={null}>
            <AppDevtools />
          </Suspense>
        ) : null}
        <Scripts />
      </body>
    </html>
  );
}
