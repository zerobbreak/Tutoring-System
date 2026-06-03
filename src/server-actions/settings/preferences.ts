import { createServerFn } from "@tanstack/react-start";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { getSupabaseAdmin } from "#/lib/supabase-admin";
import { getSettingsProfileFn } from "./get-settings-profile";
import { requireUserId } from "./require-user";
import { preferencesSchema, type UserPreferencesDTO } from "./types";

export const getDashboardPreferencesFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<
    Pick<
      UserPreferencesDTO,
      | "dashboard_show_stats"
      | "dashboard_show_notifications"
      | "dashboard_compact_mode"
      | "dashboard_show_messages"
      | "notify_on_new_messages"
    >
  > => {
    const profile = await getSettingsProfileFn();
    return {
      dashboard_show_stats: profile.preferences.dashboard_show_stats,
      dashboard_show_notifications: profile.preferences.dashboard_show_notifications,
      dashboard_compact_mode: profile.preferences.dashboard_compact_mode,
      dashboard_show_messages: profile.preferences.dashboard_show_messages,
      notify_on_new_messages: profile.preferences.notify_on_new_messages,
    };
  },
);

export const updateUserPreferencesFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => preferencesSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const userId = await requireUserId(supabase);

    const admin = getSupabaseAdmin();
    const db = admin ?? supabase;

    const { error } = await db.from("user_preferences").upsert(
      {
        user_id: userId,
        ...data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);

    return { success: true };
  });
