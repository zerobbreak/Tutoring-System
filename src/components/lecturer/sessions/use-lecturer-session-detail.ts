import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "#/lib/toast";
import {
  getLecturerSessionDetailFn,
  type LecturerSessionDetailDTO,
} from "#/server-actions/lecturer-sessions";
import {
  getSessionTimelineFn,
  type SessionTimelineEntryDTO,
} from "#/server-actions/scheduled-sessions";

export function useLecturerSessionDetail(
  claimId: string | null,
  open: boolean,
  onOpenChange: (open: boolean) => void,
) {
  const [session, setSession] = useState<LecturerSessionDetailDTO | null>(null);
  const [activity, setActivity] = useState<SessionTimelineEntryDTO[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!claimId) return;
    setLoading(true);
    try {
      const [data, timeline] = await Promise.all([
        getLecturerSessionDetailFn({ data: { claimId } }),
        getSessionTimelineFn({ data: { claimId } }),
      ]);
      setSession(data);
      setActivity(timeline);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load session");
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }, [claimId, onOpenChange]);

  useEffect(() => {
    if (open && claimId) {
      void load();
    } else {
      setSession(null);
      setActivity([]);
    }
  }, [open, claimId, load]);

  const qrUrl = useMemo(() => {
    if (!session?.qr_token || typeof window === "undefined") return null;
    return `${window.location.origin}/tutor/sessions?claim=${session.id}`;
  }, [session?.qr_token, session?.id]);

  const timeline = useMemo(
    () =>
      session?.timeline.map((item) => ({
        id: item.id,
        action_type: item.action_type,
        acted_at: item.acted_at,
        comment: item.comment,
        actorLabel: item.actor_name ?? "System",
      })) ?? [],
    [session?.timeline],
  );

  return { loading, session, activity, qrUrl, timeline } as const;
}
