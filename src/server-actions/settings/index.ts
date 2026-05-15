import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { getSupabaseAdmin } from "#/lib/supabase-admin";

async function requireUserId(
  supabase: ReturnType<typeof createSupabaseServerClient>,
): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");
  return user.id;
}

export type ReminderFrequency = "immediate" | "daily" | "weekly";
export type CalendarView = "day" | "week" | "month";

export type UserPreferencesDTO = {
  email_notifications: boolean;
  push_notifications: boolean;
  reminder_frequency: ReminderFrequency;
  calendar_week_start: 0 | 1;
  calendar_default_view: CalendarView;
  dashboard_show_stats: boolean;
  dashboard_show_notifications: boolean;
  dashboard_compact_mode: boolean;
};

export type InstitutionDTO = {
  id: string;
  name: string;
  domain: string | null;
  country: string | null;
};

export type SecurityEventDTO = {
  id: string;
  event_type: string;
  method: string;
  status: string;
  device_info: string | null;
  occurred_at: string;
};

export type SettingsProfileDTO = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  mfa_enabled: boolean;
  avatar_url: string | null;
  phone: string | null;
  department: string | null;
  office_location: string | null;
  institution: InstitutionDTO | null;
  preferences: UserPreferencesDTO;
  security_events: SecurityEventDTO[];
  available_institutions: InstitutionDTO[];
};

const DEFAULT_PREFERENCES: UserPreferencesDTO = {
  email_notifications: true,
  push_notifications: false,
  reminder_frequency: "daily",
  calendar_week_start: 1,
  calendar_default_view: "week",
  dashboard_show_stats: true,
  dashboard_show_notifications: true,
  dashboard_compact_mode: false,
};

const accountProfileSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().max(30).optional(),
  department: z.string().max(120).optional(),
  officeLocation: z.string().max(120).optional(),
});

const institutionSchema = z.object({
  institutionId: z.string().uuid(),
});

const preferencesSchema = z.object({
  email_notifications: z.boolean(),
  push_notifications: z.boolean(),
  reminder_frequency: z.enum(["immediate", "daily", "weekly"]),
  calendar_week_start: z.union([z.literal(0), z.literal(1)]),
  calendar_default_view: z.enum(["day", "week", "month"]),
  dashboard_show_stats: z.boolean(),
  dashboard_show_notifications: z.boolean(),
  dashboard_compact_mode: z.boolean(),
});

const avatarSchema = z.object({
  avatarUrl: z.string().url(),
});

export const getSettingsProfileFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<SettingsProfileDTO> => {
    const supabase = createSupabaseServerClient();
    const userId = await requireUserId(supabase);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

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

export const updateAccountProfileFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => accountProfileSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const userId = await requireUserId(supabase);
    const { fullName, phone, department, officeLocation } = data;

    const { error: authError } = await supabase.auth.updateUser({
      data: {
        full_name: fullName,
        phone: phone ?? "",
        department: department ?? "",
        office_location: officeLocation ?? "",
      },
    });
    if (authError) throw new Error(authError.message);

    const admin = getSupabaseAdmin();
    const db = admin ?? supabase;
    const { error: dbError } = await db
      .from("users")
      .update({ full_name: fullName })
      .eq("id", userId);
    if (dbError) throw new Error(dbError.message);

    return { success: true };
  });

export const updateInstitutionFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => institutionSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const userId = await requireUserId(supabase);

    const admin = getSupabaseAdmin();
    const db = admin ?? supabase;

    const { data: existing, error: readError } = await db
      .from("users")
      .select("institution_id")
      .eq("id", userId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (existing?.institution_id) {
      throw new Error(
        "Institution is already assigned. Contact an administrator to change it.",
      );
    }

    const { error } = await db
      .from("users")
      .update({ institution_id: data.institutionId })
      .eq("id", userId);
    if (error) throw new Error(error.message);

    return { success: true };
  });

export const updateAvatarUrlFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => avatarSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    await requireUserId(supabase);

    const { error } = await supabase.auth.updateUser({
      data: { avatar_url: data.avatarUrl },
    });
    if (error) throw new Error(error.message);

    return { success: true };
  });

const uploadAvatarSchema = z.object({
  fileBase64: z.string().min(1),
  contentType: z.string().min(1),
  extension: z.string().min(1).max(8),
});

export const uploadAvatarFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => uploadAvatarSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const userId = await requireUserId(supabase);

    const buf = Buffer.from(data.fileBase64, "base64");
    if (buf.byteLength > 2 * 1024 * 1024) {
      throw new Error("Image must be under 2 MB.");
    }

    const ext = data.extension.replace(/[^\w]/g, "") || "jpg";
    const path = `${userId}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, buf, {
        upsert: true,
        contentType: data.contentType,
      });
    if (uploadError) throw new Error(uploadError.message);

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    const { error: authError } = await supabase.auth.updateUser({
      data: { avatar_url: avatarUrl },
    });
    if (authError) throw new Error(authError.message);

    return { success: true, avatarUrl };
  });

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

export const syncMfaEnabledFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ enabled: z.boolean() }).parse(input),
  )
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const userId = await requireUserId(supabase);

    const admin = getSupabaseAdmin();
    const db = admin ?? supabase;

    const { error } = await db
      .from("users")
      .update({ mfa_enabled: data.enabled })
      .eq("id", userId);
    if (error) throw new Error(error.message);

    await db.from("mfa_events").insert({
      user_id: userId,
      event_type: data.enabled ? "mfa_enabled" : "mfa_disabled",
      method: "totp",
      status: "success",
      device_info: "Settings page",
    });

    return { success: true };
  });

export const logSecurityEventFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        eventType: z.string().min(1),
        method: z.string().min(1),
        status: z.string().min(1),
        deviceInfo: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const userId = await requireUserId(supabase);

    const admin = getSupabaseAdmin();
    const db = admin ?? supabase;

    await db.from("mfa_events").insert({
      user_id: userId,
      event_type: data.eventType,
      method: data.method,
      status: data.status,
      device_info: data.deviceInfo ?? null,
    });

    return { success: true };
  });

export const requestPasswordResetFn = createServerFn({ method: "POST" }).handler(
  async () => {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) throw new Error("Unauthorized");

    const { error } = await supabase.auth.resetPasswordForEmail(user.email);
    if (error) throw new Error(error.message);

    return { success: true, email: user.email };
  },
);
