import { format, parseISO } from "date-fns";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import type { ReportColumnDTO, ReportResultDTO } from "#/lib/report-types";

export type ReportExportFormat = "json" | "csv" | "xlsx" | "pdf";

function cellValue(value: string | number | null | undefined): string {
  if (value == null) return "";
  return String(value);
}

function fileBaseName(report: ReportResultDTO): string {
  const slug = report.reportType.replace(/_/g, "-");
  const from = report.filters.dateFrom;
  const to = report.filters.dateTo;
  return `${slug}_${from}_${to}`;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportReportAsJson(report: ReportResultDTO) {
  const payload = JSON.stringify(report, null, 2);
  const blob = new Blob([payload], { type: "application/json;charset=utf-8" });
  triggerDownload(blob, `${fileBaseName(report)}.json`);
}

export function exportReportAsCsv(report: ReportResultDTO) {
  const headers = report.columns.map((c) => c.label);
  const keys = report.columns.map((c) => c.key);

  const escape = (s: string) => {
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const lines: string[] = [headers.map(escape).join(",")];
  for (const row of report.rows) {
    lines.push(keys.map((k) => escape(cellValue(row[k]))).join(","));
  }

  if (report.summary && Object.keys(report.summary).length) {
    lines.push("");
    lines.push(
      Object.entries(report.summary)
        .map(([k, v]) => `${k}: ${cellValue(v)}`)
        .join(","),
    );
  }

  const blob = new Blob([lines.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  triggerDownload(blob, `${fileBaseName(report)}.csv`);
}

export function exportReportAsXlsx(report: ReportResultDTO) {
  const keys = report.columns.map((c) => c.key);
  const headerRow = report.columns.map((c) => c.label);
  const dataRows = report.rows.map((row) =>
    keys.map((k) => row[k] ?? ""),
  );

  const sheetData: (string | number)[][] = [headerRow, ...dataRows];

  if (report.summary) {
    sheetData.push([]);
    for (const [k, v] of Object.entries(report.summary)) {
      sheetData.push([k, v ?? ""]);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  XLSX.writeFile(wb, `${fileBaseName(report)}.xlsx`);
}

export function exportReportAsPdf(report: ReportResultDTO) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const margin = 40;
  let y = margin;

  doc.setFontSize(16);
  doc.text(report.title, margin, y);
  y += 22;

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(
    `Period: ${report.filters.dateFrom} — ${report.filters.dateTo}`,
    margin,
    y,
  );
  y += 14;
  doc.text(
    `Generated: ${format(parseISO(report.generatedAt), "PPpp")}`,
    margin,
    y,
  );
  y += 20;
  doc.setTextColor(0);

  const head = [report.columns.map((c) => c.label)];
  const body = report.rows.map((row) =>
    report.columns.map((c) => cellValue(row[c.key])),
  );

  autoTable(doc, {
    startY: y,
    head,
    body,
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [41, 74, 92] },
    margin: { left: margin, right: margin },
  });

  const finalY =
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? y + 40;

  if (report.summary && Object.keys(report.summary).length) {
    let summaryY = finalY + 16;
    doc.setFontSize(10);
    doc.text("Summary", margin, summaryY);
    summaryY += 14;
    for (const [k, v] of Object.entries(report.summary)) {
      doc.text(`${k}: ${cellValue(v)}`, margin, summaryY);
      summaryY += 12;
    }
  }

  doc.save(`${fileBaseName(report)}.pdf`);
}

export function exportReport(
  report: ReportResultDTO,
  format: ReportExportFormat,
) {
  switch (format) {
    case "json":
      exportReportAsJson(report);
      break;
    case "csv":
      exportReportAsCsv(report);
      break;
    case "xlsx":
      exportReportAsXlsx(report);
      break;
    case "pdf":
      exportReportAsPdf(report);
      break;
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

export function formatReportCell(
  column: ReportColumnDTO,
  value: string | number | null | undefined,
): string {
  if (value == null) return "—";
  if (
    column.key === "averageRate" &&
    typeof value === "number" &&
    value <= 1
  ) {
    return `${Math.round(value * 100)}%`;
  }
  return cellValue(value);
}
