import { differenceInHours, parseISO } from "date-fns";
import type { ReportRowDTO } from "#/lib/report-types";
import type { createSupabaseServerClient } from "#/lib/supabase-server";
import { median } from "#/server-actions/lecturer-analytics/helpers";
import { loadClaimsInRange } from "./load-report-claims";
import type { BuildCtx } from "./report-build-context";

export async function buildVerificationSla(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  ctx: BuildCtx,
) {
  const lecturerIds = new Set(
    ctx.modulesWithLecturer
      .filter((m) => ctx.lecturerModuleIds.includes(m.id) && m.lecturerId)
      .map((m) => m.lecturerId as string),
  );

  if (!lecturerIds.size) {
    return {
      columns: [
        { key: "lecturerName", label: "Lecturer" },
        { key: "modules", label: "Modules" },
        { key: "pendingCount", label: "Pending verify" },
        { key: "medianVerifyHours", label: "Median verify (h)" },
        { key: "actionsInPeriod", label: "Actions" },
      ],
      rows: [],
      summary: { lecturerCount: 0 },
    };
  }

  const { data: lecturers, error: lecErr } = await supabase
    .from("users")
    .select("id, full_name, email")
    .in("id", [...lecturerIds]);

  if (lecErr) throw new Error(lecErr.message);

  const pendingClaims = await loadClaimsInRange(
    supabase,
    ctx.lecturerModuleIds,
    ctx.dateFrom,
    ctx.dateTo,
    ctx.tutorId,
    ["PENDING_VERIFICATION"],
  );

  const pendingByLecturer = new Map<string, number>();
  for (const c of pendingClaims) {
    const mod = ctx.modulesWithLecturer.find((m) => m.id === c.module_id);
    if (!mod?.lecturerId) continue;
    pendingByLecturer.set(
      mod.lecturerId,
      (pendingByLecturer.get(mod.lecturerId) ?? 0) + 1,
    );
  }

  const claimIdsInRange = (
    await loadClaimsInRange(
      supabase,
      ctx.lecturerModuleIds,
      ctx.dateFrom,
      ctx.dateTo,
      ctx.tutorId,
    )
  ).map((c) => c.id);

  const verifyHoursByLecturer = new Map<string, number[]>();
  const actionCountByLecturer = new Map<string, number>();

  if (claimIdsInRange.length) {
    const { data: actions, error: actErr } = await supabase
      .from("verification_actions")
      .select("claim_id, actor_id, action_type, created_at")
      .in("claim_id", claimIdsInRange)
      .gte("created_at", `${ctx.dateFrom}T00:00:00`)
      .lte("created_at", `${ctx.dateTo}T23:59:59`);

    if (actErr) throw new Error(actErr.message);

    const claimSubmitted = new Map(
      (
        await loadClaimsInRange(
          supabase,
          ctx.lecturerModuleIds,
          ctx.dateFrom,
          ctx.dateTo,
        )
      ).map((c) => [c.id, c.submitted_at]),
    );

    for (const action of actions ?? []) {
      const actorId = action.actor_id as string;
      if (!lecturerIds.has(actorId)) continue;
      actionCountByLecturer.set(
        actorId,
        (actionCountByLecturer.get(actorId) ?? 0) + 1,
      );

      if (
        action.action_type === "APPROVED" ||
        action.action_type === "SIGNED_APPROVAL"
      ) {
        const submitted = claimSubmitted.get(action.claim_id as string);
        if (submitted) {
          const hours = differenceInHours(
            parseISO(action.created_at as string),
            parseISO(submitted),
          );
          if (hours >= 0) {
            const list = verifyHoursByLecturer.get(actorId) ?? [];
            list.push(hours);
            verifyHoursByLecturer.set(actorId, list);
          }
        }
      }
    }
  }

  const moduleCountByLecturer = new Map<string, number>();
  for (const m of ctx.modulesWithLecturer) {
    if (!m.lecturerId || !ctx.lecturerModuleIds.includes(m.id)) continue;
    moduleCountByLecturer.set(
      m.lecturerId,
      (moduleCountByLecturer.get(m.lecturerId) ?? 0) + 1,
    );
  }

  const rows: ReportRowDTO[] = (lecturers ?? []).map((lec) => {
    const id = lec.id as string;
    const verifyList = verifyHoursByLecturer.get(id) ?? [];
    return {
      lecturerName: lec.full_name as string,
      lecturerEmail: lec.email as string,
      modules: moduleCountByLecturer.get(id) ?? 0,
      pendingCount: pendingByLecturer.get(id) ?? 0,
      medianVerifyHours: median(verifyList),
      actionsInPeriod: actionCountByLecturer.get(id) ?? 0,
    };
  });

  rows.sort((a, b) =>
    String(a.lecturerName).localeCompare(String(b.lecturerName)),
  );

  return {
    columns: [
      { key: "lecturerName", label: "Lecturer" },
      { key: "modules", label: "Modules" },
      { key: "pendingCount", label: "Pending verify" },
      { key: "medianVerifyHours", label: "Median verify (h)" },
      { key: "actionsInPeriod", label: "Actions" },
    ],
    rows,
    summary: { lecturerCount: rows.length },
  };
}

export async function buildOnboardingStatus(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  ctx: BuildCtx,
) {
  const { data: users, error } = await supabase
    .from("users")
    .select(
      "full_name, email, role, approval_status, user_status, onboarding_step, is_active, last_login_at, created_at",
    )
    .eq("institution_id", ctx.institutionId)
    .in("role", ["TUTOR", "LECTURER", "ADMIN"])
    .order("role")
    .order("full_name");

  if (error) throw new Error(error.message);

  const rows: ReportRowDTO[] = (users ?? []).map((u) => ({
    fullName: u.full_name as string,
    email: u.email as string,
    role: u.role as string,
    approvalStatus: u.approval_status as string,
    userStatus: (u.user_status as string | null) ?? "—",
    onboardingStep: (u.onboarding_step as string | null) ?? "—",
    isActive: u.is_active ? "Yes" : "No",
    lastLoginAt: (u.last_login_at as string | null) ?? "—",
    createdAt: u.created_at as string,
  }));

  return {
    columns: [
      { key: "fullName", label: "Name" },
      { key: "email", label: "Email" },
      { key: "role", label: "Role" },
      { key: "approvalStatus", label: "Approval" },
      { key: "userStatus", label: "User status" },
      { key: "onboardingStep", label: "Onboarding step" },
      { key: "isActive", label: "Active" },
      { key: "lastLoginAt", label: "Last login" },
    ],
    rows,
    summary: { staffCount: rows.length },
  };
}
