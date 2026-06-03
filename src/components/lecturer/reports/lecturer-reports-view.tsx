import {
  BarChart3,
  ClipboardList,
  FileText,
  Loader2,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLecturerReportsPageData } from "#/components/lecturer/reports/use-lecturer-reports-page-data";
import {
  PageLoadingSpinner,
  QueryErrorBanner,
} from "#/components/ui/query-fetch-feedback";
import { queryLoadFeedbackProps } from "#/lib/query-route-props";
import { toast } from "sonner";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/components/ui/tabs";
import { cn } from "#/lib/utils";
import {
  generateLecturerReportFn,
  REPORT_CATEGORY_LABELS,
  type ReportCatalogItemDTO,
  type ReportCategory,
  type ReportResultDTO,
  type ReportType,
} from "#/server-actions/lecturer-reports";
import { ReportExportActions } from "./report-export-actions";
import { ReportPreviewTable } from "./report-preview-table";

const CATEGORY_ICONS: Record<ReportCategory, typeof BarChart3> = {
  attendance: BarChart3,
  claims: ClipboardList,
  tutor: Users,
};

export function LecturerReportsView() {
  const {
    data: pageData,
    isLoading,
    isFetching,
    error,
    refetch,
    isSuccess,
  } = useLecturerReportsPageData();
  const feedback = queryLoadFeedbackProps({ error, isFetching, refetch });

  const [category, setCategory] = useState<ReportCategory>("attendance");
  const [selectedReportId, setSelectedReportId] =
    useState<ReportType>("attendance_module");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [tutorId, setTutorId] = useState("");

  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState<ReportResultDTO | null>(null);

  useEffect(() => {
    if (!pageData) return;
    setDateFrom(pageData.defaultDateFrom);
    setDateTo(pageData.defaultDateTo);
  }, [pageData]);

  const catalogByCategory = useMemo(() => {
    const items = pageData?.catalog ?? [];
    return items.filter((c) => c.category === category);
  }, [pageData?.catalog, category]);

  useEffect(() => {
    const first = catalogByCategory[0];
    if (first && !catalogByCategory.some((c) => c.id === selectedReportId)) {
      setSelectedReportId(first.id);
    }
  }, [catalogByCategory, selectedReportId]);

  const selectedCatalogItem = pageData?.catalog.find(
    (c) => c.id === selectedReportId,
  );

  const handleGenerate = async () => {
    if (!dateFrom || !dateTo) {
      toast.error("Select a date range.");
      return;
    }
    setGenerating(true);
    try {
      const result = await generateLecturerReportFn({
        data: {
          reportType: selectedReportId,
          dateFrom,
          dateTo,
          moduleId: moduleId || undefined,
          tutorId: tutorId || undefined,
        },
      });
      setReport(result);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate report");
    } finally {
      setGenerating(false);
    }
  };

  if (isLoading && !isSuccess) {
    return <PageLoadingSpinner label="Loading reports…" />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6 md:p-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Reports
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Generate academic and operational reports for your modules. Export
            to PDF, CSV, Excel, or JSON.
          </p>
        </header>

        {feedback.loadError ? (
          <QueryErrorBanner
            message={feedback.loadError}
            onRetry={feedback.onRetryLoad}
            retrying={feedback.retryingLoad}
          />
        ) : null}

        <Tabs
          value={category}
          onValueChange={(v) => setCategory(v as ReportCategory)}
        >
          <TabsList>
            {(Object.keys(REPORT_CATEGORY_LABELS) as ReportCategory[]).map(
              (key) => {
                const Icon = CATEGORY_ICONS[key];
                return (
                  <TabsTrigger key={key} value={key} className="gap-2">
                    <Icon className="size-4" />
                    {REPORT_CATEGORY_LABELS[key]}
                  </TabsTrigger>
                );
              },
            )}
          </TabsList>

          {(Object.keys(REPORT_CATEGORY_LABELS) as ReportCategory[]).map(
            (cat) => (
              <TabsContent key={cat} value={cat} className="mt-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {pageData?.catalog
                    .filter((c) => c.category === cat)
                    .map((item) => (
                      <ReportTypeCard
                        key={item.id}
                        item={item}
                        selected={selectedReportId === item.id}
                        onSelect={() => setSelectedReportId(item.id)}
                      />
                    ))}
                </div>
              </TabsContent>
            ),
          )}
        </Tabs>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filters</CardTitle>
            <CardDescription>
              {selectedCatalogItem?.description ??
                "Choose a report type and date range."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="report-from">From</Label>
                <Input
                  id="report-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="report-to">To</Label>
                <Input
                  id="report-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Module</Label>
                <Select
                  value={moduleId || "all"}
                  onValueChange={(v) => setModuleId(v === "all" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All modules" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All modules</SelectItem>
                    {(pageData?.modules ?? []).map((mod) => (
                      <SelectItem key={mod.id} value={mod.id}>
                        {mod.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tutor</Label>
                <Select
                  value={tutorId || "all"}
                  onValueChange={(v) => setTutorId(v === "all" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All tutors" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All tutors</SelectItem>
                    {(pageData?.tutors ?? []).map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              onClick={() => void handleGenerate()}
              disabled={generating || !pageData?.modules.length}
            >
              {generating ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <FileText className="mr-2 size-4" />
                  Generate preview
                </>
              )}
            </Button>
            {!pageData?.modules.length ? (
              <p className="text-sm text-muted-foreground">
                Add modules to your account before generating reports.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-lg">
                {report?.title ?? "Preview"}
              </CardTitle>
              <CardDescription>
                {report
                  ? `${report.rows.length} row(s) · ${report.filters.dateFrom} to ${report.filters.dateTo}`
                  : "Run generate to preview data before exporting."}
              </CardDescription>
            </div>
            <ReportExportActions report={report} disabled={generating} />
          </CardHeader>
          <CardContent className="space-y-4">
            {report?.summary && Object.keys(report.summary).length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {Object.entries(report.summary).map(([key, value]) => (
                  <Badge key={key} variant="secondary" className="font-normal">
                    {key}: {value ?? "—"}
                  </Badge>
                ))}
              </div>
            ) : null}
            {report ? (
              <ReportPreviewTable report={report} />
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No preview yet. Select a report and click Generate preview.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ReportTypeCard({
  item,
  selected,
  onSelect,
}: {
  item: ReportCatalogItemDTO;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "rounded-lg border p-4 text-left transition-colors",
        selected
          ? "border-lagoon-deep bg-lagoon-deep/5 ring-1 ring-lagoon-deep/30"
          : "border-border/80 bg-card hover:bg-muted/40",
      )}
    >
      <p className="text-sm font-semibold text-foreground">{item.title}</p>
      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
        {item.description}
      </p>
    </button>
  );
}
