import * as z from "zod";

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
  dashboard_show_messages: boolean;
  notify_on_new_messages: boolean;
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

export const DEFAULT_PREFERENCES: UserPreferencesDTO = {
  email_notifications: true,
  push_notifications: false,
  reminder_frequency: "daily",
  calendar_week_start: 1,
  calendar_default_view: "week",
  dashboard_show_stats: true,
  dashboard_show_notifications: true,
  dashboard_compact_mode: false,
  dashboard_show_messages: true,
  notify_on_new_messages: true,
};

export const accountProfileSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().max(30).optional(),
  department: z.string().max(120).optional(),
  officeLocation: z.string().max(120).optional(),
});

export const institutionSchema = z.object({
  institutionId: z.string().uuid(),
});

export const preferencesSchema = z.object({
  email_notifications: z.boolean(),
  push_notifications: z.boolean(),
  reminder_frequency: z.enum(["immediate", "daily", "weekly"]),
  calendar_week_start: z.union([z.literal(0), z.literal(1)]),
  calendar_default_view: z.enum(["day", "week", "month"]),
  dashboard_show_stats: z.boolean(),
  dashboard_show_notifications: z.boolean(),
  dashboard_compact_mode: z.boolean(),
  dashboard_show_messages: z.boolean(),
  notify_on_new_messages: z.boolean(),
});

export const avatarSchema = z.object({
  avatarUrl: z.string().url(),
});

export const uploadAvatarSchema = z.object({
  fileBase64: z.string().min(1),
  contentType: z.string().min(1),
  extension: z.string().min(1).max(8),
});
