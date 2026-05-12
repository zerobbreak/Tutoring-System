import * as XLSX from "xlsx";
import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import {
  mergeScheduleParseResults,
  parseScheduleFromMatrix,
  type CellValue,
  type ScheduleParseResult,
} from "#/lib/schedule-spreadsheet";

const uploadSchema = z.object({
  fileBase64: z.string().min(1).max(20_000_000),
  fileName: z.string().min(1).max(512),
});

const MAX_BYTES = 12 * 1024 * 1024;

export function parseScheduleWorkbookBuffer(
  buffer: Uint8Array,
  _fileName: string,
): ScheduleParseResult {
  const workbook = XLSX.read(buffer, {
    type: "array",
    cellDates: true,
    raw: true,
  });

  const multi = workbook.SheetNames.length > 1;
  const parts: ScheduleParseResult[] = [];

  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    if (!ws) continue;
    const matrix = XLSX.utils.sheet_to_json<CellValue[]>(ws, {
      header: 1,
      defval: "",
      raw: true,
    }) as CellValue[][];
    parts.push(
      parseScheduleFromMatrix(matrix, {
        sheetName: multi ? sheetName : undefined,
      }),
    );
  }

  return mergeScheduleParseResults(parts);
}

/**
 * Parse CSV / Excel on the server (no LLM). Requires an authenticated tutor session.
 * Expects row-oriented sheets with a detectable header (Start + End, or Date + Start + End).
 */
export const parseScheduleUploadFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => uploadSchema.parse(input))
  .handler(async ({ data }): Promise<ScheduleParseResult> => {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(data.fileBase64, "base64");
    } catch {
      throw new Error("Invalid file encoding");
    }

    if (buffer.length > MAX_BYTES) {
      throw new Error("File too large (max 12 MB).");
    }

    const lower = data.fileName.toLowerCase();
    if (
      !lower.endsWith(".csv") &&
      !lower.endsWith(".xlsx") &&
      !lower.endsWith(".xls")
    ) {
      throw new Error("Only .csv, .xlsx, and .xls files are supported.");
    }

    return parseScheduleWorkbookBuffer(buffer, data.fileName);
  });
