import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { requireNotificationUserId } from "#/server-actions/notifications/require-user";

const idSchema = z.object({
  notificationId: z.string().uuid(),
});

export const markNotificationReadFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => idSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const supabase = createSupabaseServerClient();
    const userId = await requireNotificationUserId(supabase);
    const now = new Date().toISOString();

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true, read_at: now })
      .eq("id", data.notificationId)
      .eq("recipient_id", userId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markAllNotificationsReadFn = createServerFn({ method: "POST" })
  .handler(async (): Promise<{ ok: true; updated: number }> => {
    const supabase = createSupabaseServerClient();
    const userId = await requireNotificationUserId(supabase);
    const now = new Date().toISOString();

    const { data: rows, error } = await supabase
      .from("notifications")
      .update({ is_read: true, read_at: now })
      .eq("recipient_id", userId)
      .eq("is_read", false)
      .select("id");

    if (error) throw new Error(error.message);
    return { ok: true, updated: rows?.length ?? 0 };
  });
