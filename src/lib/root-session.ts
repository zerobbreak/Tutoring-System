import type { User } from "@supabase/supabase-js";

/** User snapshot returned by the root loader session bootstrap. */
export type RootSessionUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, string | undefined>;
};

/** Token snapshot paired with the user for client auth hydration. */
export type RootSessionSnapshot = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  user: RootSessionUser;
};

/** Session payload loaded by the root route for SSR and client sync. */
export type RootSessionData = {
  user: RootSessionUser;
  session: RootSessionSnapshot;
};

export type RootLoaderData = {
  sessionData: RootSessionData | null;
};

/** Signed-in user from SSR snapshot or live Supabase auth. */
export type SessionUser = RootSessionUser | User;
