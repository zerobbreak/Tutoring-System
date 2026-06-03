import type {
  LecturerSchedulePageDataDTO,
  ScheduleCalendarView,
  ScheduleEventDTO,
} from "#/server-actions/lecturer-schedule";
import type { SeriesFormValues } from "./schedule-series-form-dialog";
import type { OneOffFormValues } from "./schedule-one-off-dialog";

export type { ScheduleCalendarView, ScheduleEventDTO };

export type LecturerScheduleViewProps = {
  booting: boolean;
  loadError: string | null;
  onRetryLoad?: () => void;
  retryingLoad?: boolean;
  view: ScheduleCalendarView;
  focusDate: Date;
  data: LecturerSchedulePageDataDTO | null;
  onViewChange: (view: ScheduleCalendarView) => void;
  onFocusDateChange: (date: Date) => void;
  onReload: () => void;
  onCreateSeries: (values: SeriesFormValues) => Promise<void>;
  onCreateOneOff: (values: OneOffFormValues) => Promise<void>;
  onPublishSeries: (seriesId: string) => Promise<void>;
  onDeleteSeries: (seriesId: string) => Promise<void>;
  onArchiveSeries: (seriesId: string) => Promise<void>;
  onReviewChange: (
    requestId: string,
    decision: "APPROVED" | "REJECTED",
  ) => Promise<void>;
  onReviewTutorSessionRequest: (
    claimId: string,
    decision: "REJECTED" | "CHANGES_REQUESTED",
    feedback?: string,
  ) => Promise<void>;
  formBusy: boolean;
  reviewBusyId: string | null;
};
