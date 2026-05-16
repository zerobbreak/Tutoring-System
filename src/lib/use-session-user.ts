import { getRouteApi } from "@tanstack/react-router";
import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { supabase } from "#/lib/supabase";

const rootRouteApi = getRouteApi("__root__");

/**
 * Resolves the signed-in user for dashboard routes.
 * Root loader session can be stale after client sign-in; fall back to the browser session.
 */
export function useSessionUser(): {
  user: User | null;
  /** True until root loader user or client `getUser()` has been checked. */
  pending: boolean;
} {
  const { sessionData } = rootRouteApi.useLoaderData();
  const rootUser = sessionData?.user ?? null;
  const [clientUser, setClientUser] = useState<User | null | undefined>(
    rootUser ? rootUser : undefined,
  );

  useEffect(() => {
    if (rootUser) {
      setClientUser(rootUser);
      return;
    }

    let cancelled = false;

    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!cancelled) setClientUser(user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) setClientUser(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [rootUser?.id]);

  const user = rootUser ?? (clientUser === undefined ? null : clientUser);
  const pending = !rootUser && clientUser === undefined;

  return { user, pending };
}
