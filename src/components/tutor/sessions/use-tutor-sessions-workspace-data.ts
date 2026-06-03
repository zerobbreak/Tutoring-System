import { format } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ALL_STATUSES,
  claimTimes,
} from "#/components/tutor/sessions/tutor-sessions-workspace-helpers";
import { formatClock } from "#/lib/session-claim-display";
import {
  sessionKanbanColumn,
  type ClaimStatus,
  type SessionKanbanColumnId,
} from "#/lib/session-kanban-column";
import { isTutorManualRequestInPendingColumn } from "#/lib/session-request-status";
import { queryKeys } from "#/lib/query-keys";
import type { TutorHourBudgetSummary } from "#/lib/tutor-hour-budget";
import { subscribeToTutorSessionClaims } from "#/lib/tutor-sessions-realtime";
import { getTutorHourBudgetFn } from "#/server-actions/tutor-allocations";
import {
  listTutorSessionClaimsFn,
  type TutorSessionClaimDTO,
} from "#/server-actions/tutor-sessions";

export function useTutorSessionsWorkspaceData(tutorId: string | null) {
  const queryClient = useQueryClient();
  const reloadDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const claimsQuery = useQuery({
    queryKey: queryKeys.tutor.sessionClaims,
    queryFn: () => listTutorSessionClaimsFn(),
  });

  const claims = claimsQuery.data ?? [];
  const loading = claimsQuery.isLoading;

  const [now, setNow] = useState(() => new Date());
  const [searchText, setSearchText] = useState("");
  const [moduleFilter, setModuleFilter] = useState<string | "all">("all");
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [datePickOpen, setDatePickOpen] = useState(false);
  const [datePickTemp, setDatePickTemp] = useState<Date | undefined>(undefined);
  const [statusFilters, setStatusFilters] = useState<Set<ClaimStatus>>(
    () => new Set(ALL_STATUSES),
  );
  const [hourBudget, setHourBudget] = useState<TutorHourBudgetSummary | null>(
    null,
  );

  const invalidateClaims = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.tutor.sessionClaims,
    });
  }, [queryClient]);

  const reload = useCallback(
    async (options?: { silent?: boolean }) => {
      if (options?.silent) {
        invalidateClaims();
        return;
      }
      await claimsQuery.refetch();
    },
    [claimsQuery, invalidateClaims],
  );

  const scheduleSilentReload = useCallback(() => {
    if (reloadDebounceRef.current) clearTimeout(reloadDebounceRef.current);
    reloadDebounceRef.current = setTimeout(() => {
      invalidateClaims();
    }, 400);
  }, [invalidateClaims]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (!tutorId) return;
    const unsubRealtime = subscribeToTutorSessionClaims(tutorId, scheduleSilentReload);
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") scheduleSilentReload();
    }, 20_000);
    return () => {
      unsubRealtime();
      window.clearInterval(poll);
      if (reloadDebounceRef.current) clearTimeout(reloadDebounceRef.current);
    };
  }, [tutorId, scheduleSilentReload]);

  useEffect(() => {
    void getTutorHourBudgetFn()
      .then(setHourBudget)
      .catch(() => setHourBudget(null));
  }, []);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") invalidateClaims();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [invalidateClaims]);

  const moduleOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of claims) {
      if (c.module) map.set(c.module.id, `${c.module.code} — ${c.module.name}`);
    }
    return [...map.entries()];
  }, [claims]);

  const filteredClaims = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return claims.filter((c) => {
      if (!statusFilters.has(c.status)) return false;
      if (moduleFilter !== "all" && c.module_id !== moduleFilter) return false;
      if (dateFilter && c.session_date !== format(dateFilter, "yyyy-MM-dd"))
        return false;
      if (!q) return true;
      const blob = [c.module?.code, c.module?.name, c.venue, c.session_kind]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [claims, searchText, moduleFilter, dateFilter, statusFilters]);

  const visibleDrafts = useMemo(
    () => filteredClaims.filter((c) => c.status === "DRAFT"),
    [filteredClaims],
  );

  const tableSortedClaims = useMemo(
    () =>
      [...filteredClaims].sort((a, b) => {
        if (a.session_date !== b.session_date) {
          return a.session_date < b.session_date ? 1 : -1;
        }
        return `${b.start_time ?? "00:00"}`.localeCompare(
          `${a.start_time ?? "00:00"}`,
        );
      }),
    [filteredClaims],
  );

  const columns = useMemo(() => {
    const buckets: Record<SessionKanbanColumnId, TutorSessionClaimDTO[]> = {
      claimsPending: [],
      today: [],
      upcoming: [],
      completed: [],
    };
    for (const c of filteredClaims) {
      if (isTutorManualRequestInPendingColumn(c)) {
        buckets.claimsPending.push(c);
        continue;
      }
      const times = claimTimes(c);
      buckets[
        sessionKanbanColumn(
          now,
          c.session_date,
          times.start,
          times.end,
          c.status,
        )
      ].push(c);
    }
    const sortFn = (a: TutorSessionClaimDTO, b: TutorSessionClaimDTO) =>
      `${a.session_date}T${formatClock(a.start_time)}:00`.localeCompare(
        `${b.session_date}T${formatClock(b.start_time)}:00`,
      );
    for (const k of Object.keys(buckets) as SessionKanbanColumnId[]) {
      buckets[k].sort(sortFn);
    }
    return buckets;
  }, [filteredClaims, now]);

  const stats = useMemo(() => {
    const total = filteredClaims.length;
    const pendingClaims = filteredClaims.filter((c) =>
      ["DRAFT", "PENDING_VERIFICATION", "DISPUTED", "REJECTED"].includes(
        c.status,
      ),
    ).length;
    const withEvidence = filteredClaims.filter((c) => c.evidenceCount > 0).length;
    const attendanceRate =
      total === 0 ? 0 : Math.round((withEvidence / total) * 1000) / 10;
    const upcomingSessions = filteredClaims.filter((c) => {
      const times = claimTimes(c);
      return (
        sessionKanbanColumn(
          now,
          c.session_date,
          times.start,
          times.end,
          c.status,
        ) === "upcoming"
      );
    }).length;
    return { total, pendingClaims, attendanceRate, upcomingSessions };
  }, [filteredClaims, now]);

  const toggleStatus = (s: ClaimStatus) => {
    setStatusFilters((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      if (next.size === 0) return new Set(ALL_STATUSES);
      return next;
    });
  };

  const clearFilters = () => {
    setModuleFilter("all");
    setDateFilter(undefined);
    setStatusFilters(new Set(ALL_STATUSES));
  };

  return {
    claims,
    loading,
    now,
    reload,
    hourBudget,
    searchText,
    setSearchText,
    moduleFilter,
    setModuleFilter,
    dateFilter,
    setDateFilter,
    datePickOpen,
    setDatePickOpen,
    datePickTemp,
    setDatePickTemp,
    statusFilters,
    toggleStatus,
    clearFilters,
    moduleOptions,
    filteredClaims,
    visibleDrafts,
    tableSortedClaims,
    columns,
    stats,
  };
}
