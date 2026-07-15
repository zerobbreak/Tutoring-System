import { createServerFn } from "@tanstack/react-start";
import { requireAdminContext } from "#/lib/admin-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import {
  formatAuditLogSummary,
  formatMfaEventSummary,
  formatScheduleReviewSummary,
  formatVerificationSummary,
  isSuspiciousMfaEvent,
  mapVerificationCategory,
} from "./format-summary";
import { listAuditFeedSchema } from "./schemas";
import type {
  AuditFeedActorDTO,
  AuditFeedCategory,
  AuditFeedModuleDTO,
  AuditLogFeedEntryDTO,
  AuditLogFeedPageDTO,
} from "./types";

const DEDUPE_WINDOW_MS = 120_000;

function unwrapOne<T>(row: T | T[] | null): T | null {
  if (!row) return null;
  return Array.isArray(row) ? (row[0] ?? null) : row;
}

function matchesCategory(entry: AuditLogFeedEntryDTO, category: AuditFeedCategory): boolean {
  if (category === "ALL") return true;
  return entry.category === category;
}

function inDateRange(iso: string, from?: string, to?: string): boolean {
  const t = new Date(iso).getTime();
  if (from && t < new Date(from).getTime()) return false;
  if (to && t > new Date(to).getTime()) return false;
  return true;
}

type ActorRow = { id: string; full_name: string; role: string };

async function loadActorsById(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  actorIds: string[],
): Promise<Map<string, ActorRow>> {
  const unique = [...new Set(actorIds.filter(Boolean))];
  if (!unique.length) return new Map();

  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, role")
    .in("id", unique);

  if (error) throw new Error(error.message);

  return new Map(
    (data ?? []).map((u) => [
      u.id as string,
      {
        id: u.id as string,
        full_name: u.full_name as string,
        role: u.role as string,
      },
    ]),
  );
}

export const listAuditLogFeedFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => listAuditFeedSchema.parse(input ?? {}))
  .handler(async ({ data }): Promise<AuditLogFeedPageDTO> => {
    const supabase = createSupabaseServerClient();
    const { institutionId } = await requireAdminContext(supabase);

    const { data: modules } = await supabase
      .from("modules")
      .select("id, code, name")
      .eq("institution_id", institutionId)
      .eq("is_active", true)
      .order("code");

    const moduleIds = (modules ?? []).map((m) => m.id as string);
    const moduleList: AuditFeedModuleDTO[] = (modules ?? []).map((m) => ({
      id: m.id as string,
      code: m.code as string,
      name: m.name as string,
    }));

    if (data.moduleId && !moduleIds.includes(data.moduleId)) {
      return { entries: [], modules: moduleList, actors: [] };
    }

    const scopedModuleIds = data.moduleId ? [data.moduleId] : moduleIds;

    let verificationQuery = supabase
      .from("verification_actions")
      .select(
        `
        id,
        claim_id,
        actor_id,
        action_type,
        from_status,
        to_status,
        comment,
        mfa_confirmed,
        mfa_method,
        acted_at,
        claim:session_claims (
          id,
          module_id,
          module:modules ( id, code, name )
        )
      `,
      )
      .order("acted_at", { ascending: false })
      .limit(data.limit * 2);

    if (scopedModuleIds.length) {
      const { data: claimIds } = await supabase
        .from("session_claims")
        .select("id")
        .in("module_id", scopedModuleIds);
      const ids = (claimIds ?? []).map((c) => c.id as string);
      if (!ids.length) {
        verificationQuery = verificationQuery.in("claim_id", [
          "00000000-0000-0000-0000-000000000000",
        ]);
      } else {
        verificationQuery = verificationQuery.in("claim_id", ids);
      }
    }

    if (data.actorId) {
      verificationQuery = verificationQuery.eq("actor_id", data.actorId);
    }
    if (data.from) {
      verificationQuery = verificationQuery.gte("acted_at", data.from);
    }
    if (data.to) {
      verificationQuery = verificationQuery.lte("acted_at", data.to);
    }

    const verificationRes = await verificationQuery;
    if (verificationRes.error) throw new Error(verificationRes.error.message);

    const verificationRows = verificationRes.data ?? [];
    const actorsById = await loadActorsById(
      supabase,
      verificationRows.map((r) => r.actor_id as string),
    );

    const verificationDedupeTimes = new Map<string, number>();
    const verificationEntries: AuditLogFeedEntryDTO[] = [];

    for (const row of verificationRows) {
      const actorRow = actorsById.get(row.actor_id as string);
      const claim = unwrapOne(
        row.claim as unknown as
          | {
              id: string;
              module_id: string;
              module: { id: string; code: string; name: string } | null;
            }
          | {
              id: string;
              module_id: string;
              module: { id: string; code: string; name: string } | null;
            }[]
          | null,
      );
      const mod = claim?.module
        ? unwrapOne(
            claim.module as
              | { id: string; code: string; name: string }
              | { id: string; code: string; name: string }[],
          )
        : null;

      const claimId = row.claim_id as string;
      const actedAt = row.acted_at as string;
      verificationDedupeTimes.set(claimId, new Date(actedAt).getTime());

      const actionType = row.action_type as string;
      verificationEntries.push({
        id: `va:${row.id as string}`,
        source: "verification",
        occurredAt: actedAt,
        category: mapVerificationCategory(actionType),
        eventType: actionType,
        summary: formatVerificationSummary(
          actionType,
          actorRow?.full_name ?? "Unknown",
          actorRow?.role ?? "",
          mod?.code ?? null,
          claimId,
          row.to_status as string | null,
        ),
        actor: actorRow
          ? {
              id: actorRow.id,
              fullName: actorRow.full_name,
              role: actorRow.role,
            }
          : null,
        institutionId,
        module: mod
          ? { id: mod.id, code: mod.code, name: mod.name }
          : null,
        claimId,
        entityType: "SESSION_CLAIM",
        mfaConfirmed: Boolean(row.mfa_confirmed),
        ipAddress: null,
        comment: (row.comment as string | null) ?? null,
      });
    }

    let auditQuery = supabase
      .from("audit_logs")
      .select(
        "id, institution_id, actor_id, entity_type, entity_id, event, payload, ip_address, created_at",
      )
      .eq("institution_id", institutionId)
      .order("created_at", { ascending: false })
      .limit(data.limit * 2);

    if (data.actorId) auditQuery = auditQuery.eq("actor_id", data.actorId);
    if (data.from) auditQuery = auditQuery.gte("created_at", data.from);
    if (data.to) auditQuery = auditQuery.lte("created_at", data.to);

    const auditRes = await auditQuery;
    if (auditRes.error) throw new Error(auditRes.error.message);

    const claimIdsForModules = new Set<string>();
    if (data.moduleId && scopedModuleIds.length) {
      const { data: claims } = await supabase
        .from("session_claims")
        .select("id")
        .eq("module_id", data.moduleId);
      for (const c of claims ?? []) claimIdsForModules.add(c.id as string);
    }

    const auditEntries: AuditLogFeedEntryDTO[] = [];

    for (const row of auditRes.data ?? []) {
      const createdAt = row.created_at as string;
      const entityType = row.entity_type as string;
      const entityId = row.entity_id as string;
      const event = row.event as string;

      if (
        event === "STATUS_CHANGED" &&
        entityType === "SESSION_CLAIM"
      ) {
        const vaTime = verificationDedupeTimes.get(entityId);
        if (vaTime != null) {
          const delta = Math.abs(new Date(createdAt).getTime() - vaTime);
          if (delta <= DEDUPE_WINDOW_MS) continue;
        }
      }

      if (data.moduleId && entityType === "SESSION_CLAIM") {
        if (!claimIdsForModules.has(entityId)) continue;
      }

      let actor: AuditFeedActorDTO | null = null;
      if (row.actor_id) {
        const { data: userRow } = await supabase
          .from("users")
          .select("id, full_name, role")
          .eq("id", row.actor_id as string)
          .maybeSingle();
        if (userRow) {
          actor = {
            id: userRow.id as string,
            fullName: userRow.full_name as string,
            role: userRow.role as string,
          };
        }
      }

      let module: AuditFeedModuleDTO | null = null;
      let claimId: string | null =
        entityType === "SESSION_CLAIM" ? entityId : null;

      if (entityType === "SESSION_CLAIM") {
        const { data: claimRow } = await supabase
          .from("session_claims")
          .select("module:modules ( id, code, name )")
          .eq("id", entityId)
          .maybeSingle();
        const mod = unwrapOne(
          claimRow?.module as
            | { id: string; code: string; name: string }
            | { id: string; code: string; name: string }[]
            | null,
        );
        if (mod) module = { id: mod.id, code: mod.code, name: mod.name };
      }

      const payload = (row.payload as Record<string, unknown> | null) ?? {};
      let category: AuditFeedCategory = "APPROVAL";
      if (
        [
          "ROLE_CHANGED",
          "USER_ONBOARDING_REVIEWED",
          "USER_ACTIVE_CHANGED",
          "MFA_RESET_BY_ADMIN",
        ].includes(event)
      ) {
        category = event === "MFA_RESET_BY_ADMIN" ? "MFA" : "USER";
      } else if (
        [
          "SCHEDULE_SERIES_CREATED",
          "SCHEDULE_SERIES_PUBLISHED",
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
        ].includes(event) ||
        entityType === "SCHEDULED_SESSION"
      ) {
        category = "SCHEDULE";
      } else if (event === "STATUS_CHANGED") {
        category = "APPROVAL";
      }

      auditEntries.push({
        id: `al:${row.id as string}`,
        source: "audit_log",
        occurredAt: createdAt,
        category,
        eventType: event,
        summary: formatAuditLogSummary(
          event,
          actor?.fullName ?? null,
          entityType,
          payload,
        ),
        actor,
        institutionId,
        module,
        claimId,
        entityType,
        mfaConfirmed: null,
        ipAddress: (row.ip_address as string | null) ?? null,
        comment: null,
      });
    }

    let scheduleEntries: AuditLogFeedEntryDTO[] = [];
    if (scopedModuleIds.length) {
      const scheduleRes = await supabase
        .from("schedule_change_requests")
        .select(
          `
          id,
          status,
          reviewed_at,
          reviewed_by,
          reviewer:users ( id, full_name, role ),
          session:scheduled_sessions!inner (
            module_id,
            module:modules!inner ( id, code, name, institution_id )
          )
        `,
        )
        .not("reviewed_at", "is", null)
        .in("status", ["APPROVED", "REJECTED"])
        .order("reviewed_at", { ascending: false })
        .limit(data.limit);

      if (scheduleRes.error) throw new Error(scheduleRes.error.message);

      for (const row of scheduleRes.data ?? []) {
        const session = unwrapOne(
          row.session as unknown as
            | {
                module_id: string;
                module: {
                  id: string;
                  code: string;
                  name: string;
                  institution_id: string;
                };
              }
            | {
                module_id: string;
                module: {
                  id: string;
                  code: string;
                  name: string;
                  institution_id: string;
                };
              }[]
            | null,
        );
        if (!session || session.module.institution_id !== institutionId) continue;
        if (data.moduleId && session.module_id !== data.moduleId) continue;

        const reviewer = unwrapOne(
          row.reviewer as
            | { id: string; full_name: string; role: string }
            | { id: string; full_name: string; role: string }[]
            | null,
        );
        if (data.actorId && reviewer?.id !== data.actorId) continue;

        const reviewedAt = row.reviewed_at as string;
        if (!inDateRange(reviewedAt, data.from, data.to)) continue;

        const status = row.status as string;
        scheduleEntries.push({
          id: `scr:${row.id as string}`,
          source: "schedule",
          occurredAt: reviewedAt,
          category: "SCHEDULE",
          eventType:
            status === "APPROVED"
              ? "SCHEDULE_CHANGE_APPROVED"
              : "SCHEDULE_CHANGE_REJECTED",
          summary: formatScheduleReviewSummary(
            status,
            reviewer?.full_name ?? "Admin",
            session.module.code,
          ),
          actor: reviewer
            ? {
                id: reviewer.id,
                fullName: reviewer.full_name,
                role: reviewer.role,
              }
            : null,
          institutionId,
          module: {
            id: session.module.id,
            code: session.module.code,
            name: session.module.name,
          },
          claimId: null,
          entityType: "SCHEDULE_CHANGE_REQUEST",
          mfaConfirmed: null,
          ipAddress: null,
          comment: null,
        });
      }
    }

    let mfaEntries: AuditLogFeedEntryDTO[] = [];
    const { data: instUsers } = await supabase
      .from("users")
      .select("id, full_name, role")
      .eq("institution_id", institutionId);

    const instUserIds = (instUsers ?? []).map((u) => u.id as string);
    const userById = new Map(
      (instUsers ?? []).map((u) => [
        u.id as string,
        {
          id: u.id as string,
          fullName: u.full_name as string,
          role: u.role as string,
        },
      ]),
    );

    if (instUserIds.length) {
      let mfaQuery = supabase
        .from("mfa_events")
        .select(
          "id, user_id, event_type, method, status, ip_address, occurred_at",
        )
        .in("user_id", instUserIds)
        .order("occurred_at", { ascending: false })
        .limit(data.limit);

      if (data.actorId) mfaQuery = mfaQuery.eq("user_id", data.actorId);
      if (data.from) mfaQuery = mfaQuery.gte("occurred_at", data.from);
      if (data.to) mfaQuery = mfaQuery.lte("occurred_at", data.to);

      const mfaRes = await mfaQuery;

      if (!mfaRes.error) {
        for (const row of mfaRes.data ?? []) {
          const user = userById.get(row.user_id as string);
          if (!user) continue;

        const occurredAt = row.occurred_at as string;
        if (!inDateRange(occurredAt, data.from, data.to)) continue;

        const eventType = row.event_type as string;
        mfaEntries.push({
          id: `mfa:${row.id as string}`,
          source: "mfa",
          occurredAt,
          category: isSuspiciousMfaEvent(eventType) ? "SECURITY" : "MFA",
          eventType,
          summary: formatMfaEventSummary(
            eventType,
            user.fullName,
            row.status as string,
          ),
          actor: user,
          institutionId,
          module: null,
          claimId: null,
          entityType: "USER",
          mfaConfirmed: eventType.includes("enabled") || eventType.includes("confirmed"),
          ipAddress: (row.ip_address as string | null) ?? null,
          comment: null,
        });
      }
    }
    }

    const merged = [
      ...verificationEntries,
      ...auditEntries,
      ...scheduleEntries,
      ...mfaEntries,
    ]
      .filter((e) => matchesCategory(e, data.category))
      .sort(
        (a, b) =>
          new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
      )
      .slice(0, data.limit);

    const actorMap = new Map<string, AuditFeedActorDTO>();
    for (const e of merged) {
      if (e.actor) actorMap.set(e.actor.id, e.actor);
    }

    return {
      entries: merged,
      modules: moduleList,
      actors: Array.from(actorMap.values()).sort((a, b) =>
        a.fullName.localeCompare(b.fullName),
      ),
    };
  });
