import { useCallback, useEffect, useState } from "react";
import type { UserPreferencesDTO } from "#/server-actions/settings";
import { getDashboardPreferencesFn } from "#/server-actions/settings";

export const DASHBOARD_PREFS_KEY = "tutor-dashboard-prefs";
export const DASHBOARD_PREFS_CHANGED = "dashboard-prefs-changed";

export type DashboardPreferences = Pick<
  UserPreferencesDTO,
  | "dashboard_show_stats"
  | "dashboard_show_notifications"
  | "dashboard_compact_mode"
  | "dashboard_show_messages"
  | "notify_on_new_messages"
>;

export const DEFAULT_DASHBOARD_PREFERENCES: DashboardPreferences = {
  dashboard_show_stats: true,
  dashboard_show_notifications: true,
  dashboard_compact_mode: false,
  dashboard_show_messages: true,
  notify_on_new_messages: true,
};

export function dashboardPrefsFromDto(
  prefs: UserPreferencesDTO,
): DashboardPreferences {
  return {
    dashboard_show_stats: prefs.dashboard_show_stats,
    dashboard_show_notifications: prefs.dashboard_show_notifications,
    dashboard_compact_mode: prefs.dashboard_compact_mode,
    dashboard_show_messages: prefs.dashboard_show_messages,
    notify_on_new_messages: prefs.notify_on_new_messages,
  };
}

export function persistDashboardPrefsLocal(prefs: DashboardPreferences) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    DASHBOARD_PREFS_KEY,
    JSON.stringify({
      showStats: prefs.dashboard_show_stats,
      showNotifications: prefs.dashboard_show_notifications,
      compactMode: prefs.dashboard_compact_mode,
      showMessages: prefs.dashboard_show_messages,
      notifyOnNewMessages: prefs.notify_on_new_messages,
    }),
  );
  window.dispatchEvent(new CustomEvent(DASHBOARD_PREFS_CHANGED));
}

function readDashboardPrefsLocal(): DashboardPreferences | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DASHBOARD_PREFS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      showStats?: boolean;
      showNotifications?: boolean;
      compactMode?: boolean;
      showMessages?: boolean;
      notifyOnNewMessages?: boolean;
    };
    return {
      dashboard_show_stats: parsed.showStats ?? true,
      dashboard_show_notifications: parsed.showNotifications ?? true,
      dashboard_compact_mode: parsed.compactMode ?? false,
      dashboard_show_messages: parsed.showMessages ?? true,
      notify_on_new_messages: parsed.notifyOnNewMessages ?? true,
    };
  } catch {
    return null;
  }
}

export function useDashboardPreferences() {
  const [prefs, setPrefs] = useState<DashboardPreferences>(() => {
    return readDashboardPrefsLocal() ?? DEFAULT_DASHBOARD_PREFERENCES;
  });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const server = await getDashboardPreferencesFn();
      setPrefs(server);
      persistDashboardPrefsLocal(server);
    } catch {
      const local = readDashboardPrefsLocal();
      if (local) setPrefs(local);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onChange = () => {
      const local = readDashboardPrefsLocal();
      if (local) setPrefs(local);
    };
    window.addEventListener(DASHBOARD_PREFS_CHANGED, onChange);
    return () => window.removeEventListener(DASHBOARD_PREFS_CHANGED, onChange);
  }, []);

  return { prefs, loading, refresh };
}
