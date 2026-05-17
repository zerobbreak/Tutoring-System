export type ReportColumnDTO = {
  key: string;
  label: string;
};

export type ReportRowDTO = Record<string, string | number | null>;

export type ReportFiltersDTO = {
  dateFrom: string;
  dateTo: string;
  moduleId: string | null;
  tutorId: string | null;
};

export type ReportResultDTO<TReportType extends string = string> = {
  reportType: TReportType;
  title: string;
  generatedAt: string;
  filters: ReportFiltersDTO;
  columns: ReportColumnDTO[];
  rows: ReportRowDTO[];
  summary: ReportRowDTO | null;
};
