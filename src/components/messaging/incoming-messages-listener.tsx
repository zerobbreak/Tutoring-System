import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { useDashboardPreferences } from "#/lib/dashboard-preferences";
import {
  fetchMessageSenderName,
  subscribeToIncomingMessages,
} from "#/lib/messaging-realtime";
import { supabase } from "#/lib/supabase";

type IncomingMessagesListenerProps = {
  messagingPath: string;
  /** When set, Open navigates with `?conversation=` (lecturer messages). */
  conversationSearchParam?: boolean;
};

export function IncomingMessagesListener({
  messagingPath,
  conversationSearchParam = false,
}: IncomingMessagesListenerProps) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { prefs } = useDashboardPreferences();

  useEffect(() => {
    if (!prefs.notify_on_new_messages) return;
    if (pathname.startsWith(messagingPath)) return;

    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled || !user) return;

      unsubscribe = subscribeToIncomingMessages(user.id, (msg) => {
        if (msg.sender_id === user.id) return;

        void (async () => {
          const senderName = await fetchMessageSenderName(msg.sender_id);
          const preview =
            msg.content.length > 120
              ? `${msg.content.slice(0, 117)}…`
              : msg.content;

          toast.message(senderName, {
            description: preview,
            action: {
              label: "Open",
              onClick: () => {
                if (conversationSearchParam) {
                  navigate({
                    to: messagingPath,
                    search: { conversation: msg.conversation_id },
                  });
                } else {
                  navigate({ to: messagingPath });
                }
              },
            },
          });
        })();
      });
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [
    prefs.notify_on_new_messages,
    pathname,
    messagingPath,
    conversationSearchParam,
    navigate,
  ]);

  return null;
}
