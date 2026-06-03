import { createServerFn } from "@tanstack/react-start";
import { ensurePublicUserProfile } from "#/lib/ensure-public-user";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { getSupabaseAdmin } from "#/lib/supabase-admin";
import { requireUserId } from "./require-user";
import {
  DEFAULT_PREFERENCES,
  type InstitutionDTO,
  type ReminderFrequency,
  type CalendarView,
  type SecurityEventDTO,
  type SettingsProfileDTO,
  type UserPreferencesDTO,
} from "./types";

export const getSettingsProfileFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<SettingsProfileDTO> => {
    const supabase = createSupabaseServerClient();
    const userId = await requireUserId(supabase);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    await ensurePublicUserProfile(supabase);

    const admin = getSupabaseAdmin();
    const db = admin ?? supabase;

    const [userRowRes, prefsRow, eventsRes, institutionsRes] = await Promise.all([
      db
        .from("users")
        .select(
          "id, email, full_name, role, mfa_enabled, institution_id, institutions(id, name, domain, country)",
        )
        .eq("id", userId)
        .maybeSingle(),
      db.from("user_preferences").select("*").eq("user_id", userId).maybeSingle(),
      db
        .from("mfa_events")
        .select("id, event_type, method, status, device_info, occurred_at")
        .eq("user_id", userId)
        .order("occurred_at", { ascending: false })
        .limit(8),
      db
        .from("institutions")
        .select("id, name, domain, country")
        .eq("is_active", true)
        .order("name"),
    ]);

    const userRow = userRowRes.data;
    const meta = user.user_metadata ?? {};
    const institutionJoin = userRow?.institutions as
      | InstitutionDTO
      | InstitutionDTO[]
      | null
      | undefined;
    const institution = Array.isArray(institutionJoin)
      ? institutionJoin[0] ?? null
      : institutionJoin ?? null;

    const preferences: UserPreferencesDTO = prefsRow.data
      ? {
          email_notifications: prefsRow.data.email_notifications,
          push_notifications: prefsRow.data.push_notifications,
          reminder_frequency: prefsRow.data.reminder_frequency as ReminderFrequency,
          calendar_week_start: prefsRow.data.calendar_week_start as 0 | 1,
          calendar_default_view: prefsRow.data
            .calendar_default_view as CalendarView,
          dashboard_show_stats: prefsRow.data.dashboard_show_stats,
          dashboard_show_notifications:
            prefsRow.data.dashboard_show_notifications,
          dashboard_compact_mode: prefsRow.data.dashboard_compact_mode,
          dashboard_show_messages: prefsRow.data.dashboard_show_messages ?? true,
          notify_on_new_messages: prefsRow.data.notify_on_new_messages ?? true,
        }
      : DEFAULT_PREFERENCES;

    return {
      id: userId,
      email: user.email ?? userRow?.email ?? "",
      full_name:
        userRow?.full_name ??
        (meta.full_name as string | undefined) ??
        "",
      role: userRow?.role ?? (meta.role as string | undefined) ?? "TUTOR",
      mfa_enabled: userRow?.mfa_enabled ?? false,
      avatar_url: (meta.avatar_url as string | undefined) ?? null,
      phone: (meta.phone as string | undefined) ?? null,
      department: (meta.department as string | undefined) ?? null,
      office_location: (meta.office_location as string | undefined) ?? null,
      institution,
      preferences,
      security_events: (eventsRes.data ?? []) as SecurityEventDTO[],
      available_institutions: (institutionsRes.data ??
        []) as InstitutionDTO[],
    };
  },
);
