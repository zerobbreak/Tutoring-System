import {
  Calendar,
  ClipboardList,
  FileText,
  Loader2,
  ScrollText,
  Users,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ReportExportActions } from "#/components/lecturer/reports/report-export-actions";
import { ReportPreviewTable } from "#/components/lecturer/reports/report-preview-table";
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
  ADMIN_REPORT_CATEGORY_LABELS,
  generateAdminReportFn,
  getAdminReportsPageDataFn,
  type AdminReportCatalogItemDTO,
  type AdminReportCategory,
  type AdminReportResultDTO,
  type AdminReportType,
  type AdminReportsPageDataDTO,
} from "#/server-actions/admin-reports";

const CATEGORY_ICONS: Record<AdminReportCategory, typeof Wallet> = {
  payroll: Wallet,
  claims: ClipboardList,
  people: Users,
  compliance: ScrollText,
  operations: Calendar,
};

const REPORTS_WITHOUT_MODULES: AdminReportType[] = ["onboarding_status"];

export function AdminReportsView() {
  const [booting, setBooting] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pageData, setPageData] = useState<AdminReportsPageDataDTO | null>(null);

  const [category, setCategory] = useState<AdminReportCategory>("payroll");
  const [selectedReportId, setSelectedReportId] =
    useState<AdminReportType>("payroll_reconciliation");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [tutorId, setTutorId] = useState("");
  const [lecturerId, setLecturerId] = useState("");
  const [payrollExportId, setPayrollExportId] = useState("");

  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState<AdminReportResultDTO | null>(null);

  const loadPage = useCallback(async () => {
    setBooting(true);
    setLoadError(null);
    try {
      const data = await getAdminReportsPageDataFn();
      setPageData(data);
      setDateFrom(data.defaultDateFrom);
      setDateTo(data.defaultDateTo);
      if (data.payrollExports[0]) {
        setPayrollExportId(data.payrollExports[0].id);
      }
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : "Failed to load reports page",
      );
    } finally {
      setBooting(false);
    }
  }, []);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

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

  const needsModules = !REPORTS_WITHOUT_MODULES.includes(selectedReportId);
  const needsPayrollExport = selectedCatalogItem?.requiresPayrollExport ?? false;

  const canGenerate =
    !generating &&
    (!needsModules || (pageData?.modules.length ?? 0) > 0) &&
    (!needsPayrollExport || Boolean(payrollExportId));

  const handleGenerate = async () => {
    if (!dateFrom || !dateTo) {
      toast.error("Select a date range.");
      return;
    }
    if (needsPayrollExport && !payrollExportId) {
      toast.error("Select a payroll batch.");
      return;
    }
    setGenerating(true);
    try {
      const result = await generateAdminReportFn({
        data: {
          reportType: selectedReportId,
          dateFrom,
          dateTo,
          moduleId: moduleId || undefined,
          tutorId: tutorId || undefined,
          lecturerId: lecturerId || undefined,
          payrollExportId: payrollExportId || undefined,
        },
      });
      setReport(result);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate report");
    } finally {
      setGenerating(false);
    }
  };

  if (booting) {
    return (
      <div className="flex flex-1 items-center justify-center p-12">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-12">
        <p className="text-sm text-destructive">{loadError}</p>
        <Button variant="outline" onClick={() => void loadPage()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6 md:p-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Reports
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {pageData?.institutionName
              ? `${pageData.institutionName} · `
              : ""}
            Export payroll, claims workflow, compliance, and operations data to
            PDF, CSV, Excel, or JSON.
          </p>
        </header>

        <Tabs
          value={category}
          onValueChange={(v) => setCategory(v as AdminReportCategory)}
        >
          <TabsList className="h-auto flex-wrap">
            {(Object.keys(ADMIN_REPORT_CATEGORY_LABELS) as AdminReportCategory[]).map(
              (key) => {
                const Icon = CATEGORY_ICONS[key];
                return (
                  <TabsTrigger key={key} value={key} className="gap-2">
                    <Icon className="size-4" />
                    {ADMIN_REPORT_CATEGORY_LABELS[key]}
                  </TabsTrigger>
                );
              },
            )}
          </TabsList>

          {(Object.keys(ADMIN_REPORT_CATEGORY_LABELS) as AdminReportCategory[]).map(
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
                <Label htmlFor="admin-report-from">From</Label>
                <Input
                  id="admin-report-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-report-to">To</Label>
                <Input
                  id="admin-report-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
              {needsModules ? (
                <>
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
                  {selectedReportId === "verification_sla_lecturer" ? (
                    <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                      <Label>Lecturer</Label>
                      <Select
                        value={lecturerId || "all"}
                        onValueChange={(v) =>
                          setLecturerId(v === "all" ? "" : v)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All lecturers" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All lecturers</SelectItem>
                          {(pageData?.lecturers ?? []).map((l) => (
                            <SelectItem key={l.id} value={l.id}>
                              {l.fullName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                </>
              ) : null}
              {needsPayrollExport ? (
                <div className="space-y-2 sm:col-span-2">
                  <Label>Payroll batch</Label>
                  <Select
                    value={payrollExportId || "none"}
                    onValueChange={(v) =>
                      setPayrollExportId(v === "none" ? "" : v)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select batch" />
                    </SelectTrigger>
                    <SelectContent>
                      {(pageData?.payrollExports ?? []).length === 0 ? (
                        <SelectItem value="none" disabled>
                          No batches yet
                        </SelectItem>
                      ) : (
                        (pageData?.payrollExports ?? []).map((batch) => (
                          <SelectItem key={batch.id} value={batch.id}>
                            {batch.period_label} ({batch.claim_count} claims)
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>
            <Button onClick={() => void handleGenerate()} disabled={!canGenerate}>
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
            {needsModules && !pageData?.modules.length ? (
              <p className="text-sm text-muted-foreground">
                Add modules under Institutions before generating module-scoped
                reports.
              </p>
            ) : null}
            {needsPayrollExport && !pageData?.payrollExports.length ? (
              <p className="text-sm text-muted-foreground">
                Create a payroll batch under Payroll first.
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
                {Object.entries(report.summary).map(([key, value]) =>
                  value == null ? null : (
                    <Badge key={key} variant="secondary" className="font-normal">
                      {key}: {value}
                    </Badge>
                  ),
                )}
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
  item: AdminReportCatalogItemDTO;
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
      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
        {item.description}
      </p>
    </button>
  );
}
