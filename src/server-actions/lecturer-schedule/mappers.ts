import { parseRecurrenceJson } from "#/lib/schedule-recurrence";
import type {
  ScheduleChangeRequestDTO,
  ScheduleEventDTO,
  ScheduleSeriesDTO,
} from "./types";

type SessionRow = {
  id: string;
  series_id: string;
  module_id: string;
  tutor_id: string;
  starts_at: string;
  ends_at: string;
  venue_id: string | null;
  venue_text: string | null;
  status: string;
  module: { id: string; code: string; name: string } | null;
  tutor: { id: string; full_name: string } | null;
  series: { id: string; title: string; session_kind: string } | null;
  venue: { id: string; name: string } | null;
};

export function mapScheduleEventRow(
  row: SessionRow,
  claimIdBySession: Map<string, string>,
): ScheduleEventDTO {
  const venueName = row.venue?.name ?? null;
  const venueText = row.venue_text?.trim() || venueName;
  return {
    id: row.id,
    seriesId: row.series_id,
    moduleId: row.module_id,
    moduleCode: row.module?.code ?? "",
    moduleName: row.module?.name ?? "",
    title: row.series?.title ?? "Session",
    tutorId: row.tutor_id,
    tutorName: row.tutor?.full_name ?? "",
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    venueName,
    venueText,
    status: row.status,
    sessionKind: row.series?.session_kind ?? "tutorial",
    claimId: claimIdBySession.get(row.id) ?? null,
  };
}

export function mapSeriesRow(row: {
  id: string;
  module_id: string;
  title: string;
  session_kind: string;
  tutor_id: string;
  venue_id: string | null;
  venue_text: string | null;
  timezone: string;
  dtstart: string;
  duration_minutes: number;
  recurrence_json: unknown;
  status: string;
  published_at: string | null;
  module: { code: string } | null;
  tutor: { full_name: string } | null;
}): ScheduleSeriesDTO {
  const recurrence = parseRecurrenceJson(row.recurrence_json);
  return {
    id: row.id,
    moduleId: row.module_id,
    moduleCode: row.module?.code ?? "",
    title: row.title,
    sessionKind: row.session_kind,
    tutorId: row.tutor_id,
    tutorName: row.tutor?.full_name ?? "",
    venueId: row.venue_id,
    venueText: row.venue_text,
    timezone: row.timezone,
    dtstart: row.dtstart,
    durationMinutes: row.duration_minutes,
    recurrence: {
      frequency: "weekly",
      byWeekday: recurrence.byWeekday,
      until: recurrence.until,
    },
    status: row.status,
    publishedAt: row.published_at,
  };
}

export function mapChangeRequestRow(row: {
  id: string;
  scheduled_session_id: string;
  status: string;
  proposed_starts_at: string;
  proposed_ends_at: string;
  proposed_venue_text: string | null;
  reason: string | null;
  created_at: string;
  requested_by_user: { full_name: string } | null;
  session: {
    starts_at: string;
    ends_at: string;
    series: { title: string } | null;
    module: { code: string } | null;
  } | null;
}): ScheduleChangeRequestDTO {
  return {
    id: row.id,
    scheduledSessionId: row.scheduled_session_id,
    status: row.status,
    proposedStartsAt: row.proposed_starts_at,
    proposedEndsAt: row.proposed_ends_at,
    proposedVenueName: row.proposed_venue_text,
    reason: row.reason,
    tutorName: row.requested_by_user?.full_name ?? "",
    moduleCode: row.session?.module?.code ?? "",
    sessionTitle: row.session?.series?.title ?? "Session",
    currentStartsAt: row.session?.starts_at ?? "",
    currentEndsAt: row.session?.ends_at ?? "",
    createdAt: row.created_at,
  };
}
