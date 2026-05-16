import { createServerFn } from "@tanstack/react-start";
import { format, subDays } from "date-fns";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { DEFAULT_REPORT_LOOKBACK_DAYS, REPORT_CATALOG } from "./constants";
import { loadLecturerContext } from "./helpers";
import type { LecturerReportsPageDataDTO } from "./types";

export const getLecturerReportsPageDataFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<LecturerReportsPageDataDTO> => {
    const supabase = createSupabaseServerClient();
    const { modules } = await loadLecturerContext(supabase);
    const moduleIds = modules.map((m) => m.id);
    const now = new Date();

    const tutors: LecturerReportsPageDataDTO["tutors"] = [];

    if (moduleIds.length) {
      const { data: assignmentRows, error } = await supabase
        .from("tutor_assignments")
        .select("tutor:users ( id, full_name, email )")
        .in("module_id", moduleIds)
        .eq("is_active", true);

      if (error) throw new Error(error.message);

      const seen = new Set<string>();
      for (const row of assignmentRows ?? []) {
        const tutor = Array.isArray(row.tutor) ? row.tutor[0] : row.tutor;
        if (!tutor || seen.has(tutor.id as string)) continue;
        seen.add(tutor.id as string);
        tutors.push({
          id: tutor.id as string,
          fullName: tutor.full_name as string,
          email: tutor.email as string,
        });
      }

      tutors.sort((a, b) => a.fullName.localeCompare(b.fullName));
    }

    return {
      modules,
      tutors,
      catalog: REPORT_CATALOG,
      defaultDateFrom: format(
        subDays(now, DEFAULT_REPORT_LOOKBACK_DAYS),
        "yyyy-MM-dd",
      ),
      defaultDateTo: format(now, "yyyy-MM-dd"),
    };
  },
);
