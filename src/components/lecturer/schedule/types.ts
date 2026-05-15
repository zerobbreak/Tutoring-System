import type {
  LecturerSchedulePageDataDTO,
  ScheduleCalendarView,
  ScheduleEventDTO,
} from "#/server-actions/lecturer-schedule";
import type { SeriesFormValues } from "./schedule-series-form-dialog";

export type { ScheduleCalendarView, ScheduleEventDTO };

export type LecturerScheduleViewProps = {
  booting: boolean;
  loadError: string | null;
  view: ScheduleCalendarView;
  focusDate: Date;
  data: LecturerSchedulePageDataDTO | null;
  onViewChange: (view: ScheduleCalendarView) => void;
  onFocusDateChange: (date: Date) => void;
  onReload: () => void;
  onCreateSeries: (
    values: SeriesFormValues & { dtstart: string; until: string | null },
  ) => Promise<void>;
  onPublishSeries: (seriesId: string) => Promise<void>;
  onReviewChange: (
    requestId: string,
    decision: "APPROVED" | "REJECTED",
  ) => Promise<void>;
  formBusy: boolean;
  reviewBusyId: string | null;
};
