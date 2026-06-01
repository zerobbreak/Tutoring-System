import type { ReportRowDTO } from "#/lib/report-types";
import type { createSupabaseServerClient } from "#/lib/supabase-server";
import type { BuildCtx } from "./report-build-context";

export async function buildAuditLogExport(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  ctx: BuildCtx,
) {
  const { data: logs, error } = await supabase
    .from("audit_logs")
    .select(
      "id, created_at, event, entity_type, entity_id, actor_id, ip_address, payload",
    )
    .eq("institution_id", ctx.institutionId)
    .gte("created_at", `${ctx.dateFrom}T00:00:00`)
    .lte("created_at", `${ctx.dateTo}T23:59:59`)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) throw new Error(error.message);

  const actorIds = [
    ...new Set((logs ?? []).map((l) => l.actor_id as string).filter(Boolean)),
  ];
  const actorNames = new Map<string, string>();
  if (actorIds.length) {
    const { data: actors } = await supabase
      .from("users")
      .select("id, full_name")
      .in("id", actorIds);
    for (const a of actors ?? []) {
      actorNames.set(a.id as string, a.full_name as string);
    }
  }

  const rows: ReportRowDTO[] = (logs ?? []).map((l) => ({
    occurredAt: l.created_at as string,
    event: l.event as string,
    entityType: l.entity_type as string,
    entityId: l.entity_id as string,
    actorName: l.actor_id ? (actorNames.get(l.actor_id as string) ?? l.actor_id) : "—",
    ipAddress: (l.ip_address as string | null) ?? "—",
    payloadSummary:
      l.payload && typeof l.payload === "object"
        ? JSON.stringify(l.payload).slice(0, 120)
        : "—",
  }));

  return {
    columns: [
      { key: "occurredAt", label: "When" },
      { key: "event", label: "Event" },
      { key: "entityType", label: "Entity" },
      { key: "actorName", label: "Actor" },
      { key: "ipAddress", label: "IP" },
      { key: "payloadSummary", label: "Payload" },
    ],
    rows,
    summary: {
      eventCount: rows.length,
      note: rows.length >= 5000 ? "Capped at 5000 events" : null,
    },
  };
}
