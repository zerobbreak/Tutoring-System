import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { NotificationCategory } from "#/lib/notification-category";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { requireNotificationUserId } from "#/server-actions/notifications/require-user";
import { mapNotificationRow } from "#/server-actions/notifications/map-row";
import type { NotificationRowDTO } from "#/server-actions/notifications/types";

const listSchema = z.object({
  category: z
    .enum([
      "ACTION_REQUIRED",
      "SCHEDULE_CHANGE",
      "APPROVAL_UPDATE",
      "ATTENDANCE_ISSUE",
      "INFORMATIONAL",
    ])
    .optional(),
  unreadOnly: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export const listNotificationsForUserFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => listSchema.parse(input ?? {}))
  .handler(async ({ data }): Promise<NotificationRowDTO[]> => {
    const supabase = createSupabaseServerClient();
    const userId = await requireNotificationUserId(supabase);

    let query = supabase
      .from("notifications")
      .select(
        "id, type, subject, body, claim_id, is_read, read_at, sent_at",
      )
      .eq("recipient_id", userId)
      .order("sent_at", { ascending: false })
      .limit(data.limit ?? 50);

    if (data.unreadOnly) {
      query = query.eq("is_read", false);
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    let mapped = (rows ?? []).map((r) =>
      mapNotificationRow(r as Record<string, unknown>),
    );

    if (data.category) {
      mapped = mapped.filter((n) => n.category === data.category);
    }

    return mapped;
  });

export function filterByCategory(
  rows: NotificationRowDTO[],
  category: NotificationCategory,
): NotificationRowDTO[] {
  return rows.filter((r) => r.category === category);
}
