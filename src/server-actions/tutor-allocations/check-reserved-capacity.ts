import type { SupabaseClient } from "@supabase/supabase-js";
import { assertReservedCapacity, sumOccurrenceHours } from "#/lib/tutor-hour-budget";
import {
  materializeOccurrences,
  parseRecurrenceJson,
  type MaterializedOccurrence,
} from "#/lib/schedule-recurrence";
import {
  getAllocationForModuleTerm,
  loadTutorBudgetContext,
  resolveAcademicTermIdForModule,
} from "./load-budget-context";

type Db = SupabaseClient;

export async function checkReservedCapacityForOccurrences(
  db: Db,
  input: {
    tutorId: string;
    moduleId: string;
    institutionId: string;
    occurrences: MaterializedOccurrence[];
    /** Exclude existing series sessions when re-publishing */
    excludeSeriesId?: string;
    strict?: boolean;
  },
): Promise<void> {
  const strict = input.strict ?? true;
  if (!input.occurrences.length) return;

  const firstDate = input.occurrences[0]!.startsAt.toISOString().slice(0, 10);
  const termId = await resolveAcademicTermIdForModule(
    db,
    input.moduleId,
    firstDate,
  );
  if (!termId) return;

  const allocated = await getAllocationForModuleTerm(
    db,
    input.tutorId,
    input.moduleId,
    termId,
  );
  if (allocated == null) {
    if (!strict) return;
    return;
  }

  const { summary } = await loadTutorBudgetContext(
    db,
    input.tutorId,
    input.institutionId,
  );

  let currentReserved = 0;
  const row = summary.byModule.find(
    (m) => m.moduleId === input.moduleId && m.academicTermId === termId,
  );
  if (row) currentReserved = row.reservedHours;

  if (input.excludeSeriesId) {
    const { data: existing, error } = await db
      .from("scheduled_sessions")
      .select("starts_at, ends_at")
      .eq("series_id", input.excludeSeriesId)
      .eq("tutor_id", input.tutorId)
      .is("deleted_at", null)
      .neq("status", "CANCELLED");

    if (error) throw new Error(error.message);
    for (const s of existing ?? []) {
      currentReserved -= sumOccurrenceHours([
        {
          startsAt: new Date(s.starts_at as string),
          endsAt: new Date(s.ends_at as string),
        },
      ]);
    }
    currentReserved = Math.max(0, Math.round(currentReserved * 10) / 10);
  }

  const additional = sumOccurrenceHours(input.occurrences);

  const { data: mod } = await db
    .from("modules")
    .select("code")
    .eq("id", input.moduleId)
    .maybeSingle();

  assertReservedCapacity({
    allocatedHours: allocated,
    currentReservedHours: currentReserved,
    additionalHours: additional,
    moduleCode: (mod?.code as string) ?? undefined,
    strict,
  });
}

export async function checkReservedCapacityForSeriesPublish(
  db: Db,
  seriesId: string,
): Promise<void> {
  const { data: series, error } = await db
    .from("schedule_series")
    .select(
      "id, module_id, tutor_id, dtstart, duration_minutes, recurrence_json",
    )
    .eq("id", seriesId)
    .single();

  if (error) throw new Error(error.message);

  const { data: mod, error: modErr } = await db
    .from("modules")
    .select("institution_id")
    .eq("id", series.module_id as string)
    .maybeSingle();

  if (modErr) throw new Error(modErr.message);
  if (!mod?.institution_id) return;

  const recurrence = parseRecurrenceJson(series.recurrence_json);
  const occurrences = materializeOccurrences({
    dtstart: new Date(series.dtstart as string),
    durationMinutes: series.duration_minutes as number,
    recurrence,
  });

  await checkReservedCapacityForOccurrences(db, {
    tutorId: series.tutor_id as string,
    moduleId: series.module_id as string,
    institutionId: mod.institution_id as string,
    occurrences,
    excludeSeriesId: seriesId,
    strict: true,
  });
}

export async function checkReservedCapacityForStandaloneClaim(
  db: Db,
  input: {
    tutorId: string;
    moduleId: string;
    institutionId: string;
    hours: number;
    sessionDate: string;
  },
): Promise<void> {
  const termId = await resolveAcademicTermIdForModule(
    db,
    input.moduleId,
    input.sessionDate,
  );
  if (!termId) return;

  const allocated = await getAllocationForModuleTerm(
    db,
    input.tutorId,
    input.moduleId,
    termId,
  );
  if (allocated == null) return;

  const { summary } = await loadTutorBudgetContext(
    db,
    input.tutorId,
    input.institutionId,
  );
  const row = summary.byModule.find(
    (m) => m.moduleId === input.moduleId && m.academicTermId === termId,
  );
  const currentReserved = row?.reservedHours ?? 0;

  const { data: mod } = await db
    .from("modules")
    .select("code")
    .eq("id", input.moduleId)
    .maybeSingle();

  assertReservedCapacity({
    allocatedHours: allocated,
    currentReservedHours: currentReserved,
    additionalHours: input.hours,
    moduleCode: (mod?.code as string) ?? undefined,
    strict: true,
  });
}
