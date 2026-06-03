import { notificationCategory } from "#/lib/notification-category";
import type { NotificationRowDTO } from "#/server-actions/notifications/types";

export function mapNotificationRow(row: Record<string, unknown>): NotificationRowDTO {
  const type = row.type as string;
  return {
    id: row.id as string,
    type,
    category: notificationCategory(type),
    subject: row.subject as string,
    body: row.body as string,
    claim_id: (row.claim_id as string | null) ?? null,
    is_read: Boolean(row.is_read),
    read_at: (row.read_at as string | null) ?? null,
    sent_at: row.sent_at as string,
  };
}
