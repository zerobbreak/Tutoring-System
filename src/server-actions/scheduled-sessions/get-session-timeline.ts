import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { formatWorkflowActionLabel } from "#/lib/claim-workflow-timeline";
import { eventTypeLabel } from "#/lib/schedule-sync/classify-change";
import type { ScheduleSyncEventType } from "#/lib/schedule-sync/types";
import { formatAuditLogSummary } from "#/server-actions/admin-audit-logs/format-summary";
import { createSupabaseServerClient } from "#/lib/supabase-server";

const inputSchema = z.object({
  claimId: z.string().uuid(),
});

export type SessionTimelineCategory =
  | "SCHEDULE"
  | "CLAIM"
  | "ATTENDANCE"
  | "SYSTEM";

export type SessionTimelineEntryDTO = {
  id: string;
  at: string;
  label: string;
  category: SessionTimelineCategory;
  actorName: string | null;
};

const SCHEDULE_SYNC_EVENTS = new Set([
  "SESSION_TIME_CHANGED",
  "VENUE_CHANGED",
  "TUTOR_REASSIGNED",
  "SESSION_CANCELLED",
  "SESSION_RESTORED",
  "SCHEDULED_SESSION_CANCELLED",
  "SCHEDULED_SESSION_RESTORED",
  "SCHEDULED_SESSION_SOFT_DELETED",
  "SCHEDULE_SYNC_DRAFT_REPAIRED",
  "SCHEDULE_SYNC_SKIPPED_FROZEN_CLAIM",
]);

function mapAuditCategory(
  event: string,
  entityType: string,
): SessionTimelineCategory {
  if (SCHEDULE_SYNC_EVENTS.has(event) || entityType === "SCHEDULED_SESSION") {
    return "SCHEDULE";
  }
  if (entityType === "SESSION_CLAIM") {
    return event.includes("ATTENDANCE") ? "ATTENDANCE" : "CLAIM";
  }
  return "SYSTEM";
}

function formatScheduleAuditLabel(
  event: string,
  actorName: string | null,
  payload: Record<string, unknown> | null,
): string {
  if (
    [
      "SESSION_TIME_CHANGED",
      "VENUE_CHANGED",
      "TUTOR_REASSIGNED",
      "SESSION_CANCELLED",
      "SESSION_RESTORED",
    ].includes(event)
  ) {
    return `${actorName ?? "System"} — ${eventTypeLabel(event as ScheduleSyncEventType)}`;
  }
  return formatAuditLogSummary(event, actorName, "SCHEDULED_SESSION", payload);
}

export const getSessionTimelineFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<SessionTimelineEntryDTO[]> => {
    const supabase = createSupabaseServerClient();
    const entries: SessionTimelineEntryDTO[] = [];

    const { data: claim, error: claimErr } = await supabase
      .from("session_claims")
      .select("id, source_scheduled_session_id")
      .eq("id", data.claimId)
      .maybeSingle();

    if (claimErr) throw new Error(claimErr.message);
    if (!claim) throw new Error("Session not found.");

    const scheduledSessionId = claim.source_scheduled_session_id as string | null;
    const { data: vaRows, error: vaErr } = await supabase
      .from("verification_actions")
      .select(
        `
        id,
        action_type,
        acted_at,
        actor:users!verification_actions_actor_id_fkey ( full_name )
      `,
      )
      .eq("claim_id", data.claimId)
      .order("acted_at", { ascending: false });

    if (vaErr) throw new Error(vaErr.message);

    for (const row of vaRows ?? []) {
      const actor = Array.isArray(row.actor) ? row.actor[0] : row.actor;
      entries.push({
        id: `va:${row.id as string}`,
        at: row.acted_at as string,
        label: formatWorkflowActionLabel(row.action_type as string),
        category: "CLAIM",
        actorName: (actor as { full_name?: string } | null)?.full_name ?? null,
      });
    }

    if (scheduledSessionId) {
      const [sessionAuditRes, claimAuditRes] = await Promise.all([
        supabase
          .from("audit_logs")
          .select("id, event, entity_type, entity_id, actor_id, payload, created_at")
          .eq("entity_type", "SCHEDULED_SESSION")
          .eq("entity_id", scheduledSessionId)
          .order("created_at", { ascending: false })
          .limit(80),
        supabase
          .from("audit_logs")
          .select("id, event, entity_type, entity_id, actor_id, payload, created_at")
          .eq("entity_type", "SESSION_CLAIM")
          .eq("entity_id", data.claimId)
          .order("created_at", { ascending: false })
          .limit(40),
      ]);

      if (sessionAuditRes.error) throw new Error(sessionAuditRes.error.message);
      if (claimAuditRes.error) throw new Error(claimAuditRes.error.message);

      const auditRows = [
        ...(sessionAuditRes.data ?? []),
        ...(claimAuditRes.data ?? []),
      ];

      const actorIds = [
        ...new Set(
          (auditRows ?? [])
            .map((r) => r.actor_id as string | null)
            .filter(Boolean),
        ),
      ] as string[];

      const actorNames = new Map<string, string>();
      if (actorIds.length) {
        const { data: users } = await supabase
          .from("users")
          .select("id, full_name")
          .in("id", actorIds);
        for (const u of users ?? []) {
          actorNames.set(u.id as string, u.full_name as string);
        }
      }

      for (const row of auditRows ?? []) {
        const event = row.event as string;
        const entityType = row.entity_type as string;
        const payload = (row.payload as Record<string, unknown> | null) ?? {};
        const actorName = row.actor_id
          ? (actorNames.get(row.actor_id as string) ?? null)
          : null;

        entries.push({
          id: `al:${row.id as string}`,
          at: row.created_at as string,
          label: formatScheduleAuditLabel(event, actorName, payload),
          category: mapAuditCategory(event, entityType),
          actorName,
        });
      }

      const { data: changeRows, error: chErr } = await supabase
        .from("schedule_change_requests")
        .select(
          `
          id,
          status,
          reviewed_at,
          reviewer:users!schedule_change_requests_reviewed_by_fkey ( full_name )
        `,
        )
        .eq("scheduled_session_id", scheduledSessionId)
        .in("status", ["APPROVED", "REJECTED"])
        .order("reviewed_at", { ascending: false });

      if (chErr) throw new Error(chErr.message);

      for (const row of changeRows ?? []) {
        const reviewer = Array.isArray(row.reviewer)
          ? row.reviewer[0]
          : row.reviewer;
        const name = (reviewer as { full_name?: string } | null)?.full_name ?? "Reviewer";
        const status = row.status as string;
        entries.push({
          id: `scr:${row.id as string}`,
          at: row.reviewed_at as string,
          label:
            status === "APPROVED"
              ? `${name} approved schedule change request`
              : `${name} rejected schedule change request`,
          category: "SCHEDULE",
          actorName: name,
        });
      }
    }

    return entries.sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
    );
  });
