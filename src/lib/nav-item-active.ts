export function normalizePath(path: string) {
  return path === "/" ? path : path.replace(/\/+$/, "");
}

export function pathMatches(pathname: string, to: string) {
  const current = normalizePath(pathname);
  const target = normalizePath(to);
  return current === target || current.startsWith(`${target}/`);
}

/** Home matches only when no other nav path under the same prefix is a better fit. */
export function navItemActive(
  pathname: string,
  to: string,
  homePath: string,
  navPaths: readonly string[],
) {
  const home = normalizePath(homePath);
  const target = normalizePath(to);

  if (!pathMatches(pathname, target)) {
    return false;
  }

  if (target !== home) {
    return true;
  }

  const hasMoreSpecificNavMatch = navPaths.some((path) => {
    const normalized = normalizePath(path);
    return (
      normalized !== home &&
      normalized.startsWith(`${home}/`) &&
      pathMatches(pathname, normalized)
    );
  });

  return !hasMoreSpecificNavMatch;
}
