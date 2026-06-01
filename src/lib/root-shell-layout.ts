export type RootShellLayout = {
  showPublicNav: boolean;
  isDashboardShell: boolean;
  bodyClassName: string;
  mainClassName: string | undefined;
};

function isUnderPath(pathname: string, base: string) {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/** Derives document chrome flags from the current pathname. */
export function resolveRootShellLayout(pathname: string): RootShellLayout {
  const isAuthPage = pathname.startsWith("/auth");
  const isPublicStudentPage = pathname.startsWith("/student");
  const isDashboardShell =
    isUnderPath(pathname, "/tutor") ||
    isUnderPath(pathname, "/admin") ||
    isUnderPath(pathname, "/lecturer");

  return {
    showPublicNav: !isAuthPage && !isDashboardShell && !isPublicStudentPage,
    isDashboardShell,
    bodyClassName: isDashboardShell
      ? "flex h-screen flex-col overflow-hidden"
      : "min-h-screen",
    mainClassName: isDashboardShell
      ? "flex min-h-0 flex-1 flex-col"
      : undefined,
  };
}
