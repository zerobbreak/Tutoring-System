import type { User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { AppShellUser } from "#/components/app-shell";
import type { RootSessionData, RootSessionUser } from "#/lib/root-session";
import { resetQueryCache } from "#/lib/query-client";
import { supabase } from "#/lib/supabase";

function toAppShellUser(
  user: RootSessionUser | User | null | undefined,
): AppShellUser | null {
  if (!user) return null;
  return {
    email: user.email,
    user_metadata: user.user_metadata as
      | Record<string, string | undefined>
      | undefined,
  };
}

/**
 * Keeps root document auth state aligned with the loader snapshot and browser session.
 */
export function useRootAuthSync(
  sessionData: RootSessionData | null | undefined,
): AppShellUser | null {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [sessionUser, setSessionUser] = useState<AppShellUser | null>(() =>
    toAppShellUser(sessionData?.user),
  );

  useEffect(() => {
    if (sessionData?.user) {
      setSessionUser(toAppShellUser(sessionData.user));
    }
  }, [sessionData]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSessionUser(toAppShellUser(session?.user));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSessionUser(toAppShellUser(session?.user));
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        resetQueryCache(queryClient);
        void router.invalidate();
      }
    });

    return () => subscription.unsubscribe();
  }, [queryClient, router]);

  return sessionUser;
}
