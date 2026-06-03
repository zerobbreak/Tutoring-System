import { createServerFn } from "@tanstack/react-start";
import { requireAdminContext } from "#/lib/admin-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { ANALYTICS_LOOKBACK_DAYS } from "#/server-actions/lecturer-analytics/constants";
import { buildAdminComparisons } from "./build-admin-comparisons";
import { buildAdminInstitutionSnapshot } from "./build-admin-institution-snapshot";
import { buildAdminKpisAndTrends } from "./build-admin-kpis-and-trends";
import { buildAdminLecturerAnalytics } from "./build-admin-lecturer-analytics";
import { buildAdminModuleAnalytics } from "./build-admin-module-analytics";
import { buildAdminTutorAnalytics } from "./build-admin-tutor-analytics";
import { buildAdminWorkflow } from "./build-admin-workflow";
import { emptyAdminAnalytics } from "./empty-admin-analytics";
import { loadAdminAnalyticsData } from "./load-admin-analytics-data";
import type { AdminAnalyticsDTO } from "./types";

export const getAdminAnalyticsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminAnalyticsDTO> => {
    const supabase = createSupabaseServerClient();
    const { institutionId } = await requireAdminContext(supabase);

    const loaded = await loadAdminAnalyticsData(supabase, institutionId);
    if (loaded.kind === "empty") {
      return {
        ...emptyAdminAnalytics(),
        institutionName: loaded.institutionName,
      };
    }

    const ctx = loaded.ctx;
    const { kpis, attendanceTrend, claimsVolumeTrend } =
      buildAdminKpisAndTrends(ctx);
    const workflow = buildAdminWorkflow(ctx);
    const { tutors, workloadDistribution } = buildAdminTutorAnalytics(ctx);
    const { modules, moduleHeatMap } = buildAdminModuleAnalytics(ctx);
    const lecturers = buildAdminLecturerAnalytics(ctx);
    const comparisons = await buildAdminComparisons(ctx);
    const { institution, onboarding } =
      await buildAdminInstitutionSnapshot(ctx);

    return {
      institutionName: ctx.institutionName,
      lookbackDays: ANALYTICS_LOOKBACK_DAYS,
      kpis,
      attendanceTrend,
      claimsVolumeTrend,
      tutors,
      modules,
      moduleHeatMap,
      lecturers,
      workflow,
      workloadDistribution,
      onboarding,
      comparisons,
      institution,
    };
  },
);
