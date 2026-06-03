import type { NotificationCategory } from "#/lib/notification-category";

export type NotificationRowDTO = {
  id: string;
  type: string;
  category: NotificationCategory;
  subject: string;
  body: string;
  claim_id: string | null;
  is_read: boolean;
  read_at: string | null;
  sent_at: string;
};
