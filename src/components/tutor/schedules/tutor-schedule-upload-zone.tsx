import { useCallback, useRef, useState } from "react";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Upload,
} from "lucide-react";
import { Button } from "#/components/ui/button";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";

const ACCEPT = ".csv,.xlsx,.xls";

function isAcceptedFile(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.endsWith(".csv") ||
    lower.endsWith(".xlsx") ||
    lower.endsWith(".xls")
  );
}

type TutorScheduleUploadZoneProps = {
  busy: boolean;
  loadingSaved?: boolean;
  onFile: (file: File) => void;
  onSampleDownload: () => void;
  variant?: "empty" | "compact";
};

export function TutorScheduleUploadZone({
  busy,
  loadingSaved = false,
  onFile,
  onSampleDownload,
  variant = "empty",
}: TutorScheduleUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const pick = useCallback(
    (file: File | undefined) => {
      if (!file || busy || loadingSaved) return;
      if (!isAcceptedFile(file.name)) {
        toast.error("Use a CSV or Excel file (.csv, .xlsx, .xls).");
        return;
      }
      onFile(file);
    },
    [busy, loadingSaved, onFile],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    pick(e.dataTransfer.files?.[0]);
  };

  const isEmpty = variant === "empty";
  const disabled = busy || loadingSaved;

  return (
    <div className={isEmpty ? "w-full max-w-2xl" : "w-full"}>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          "relative rounded-2xl border-2 border-dashed transition-colors",
          isEmpty ? "p-10 md:p-12" : "p-6",
          dragOver
            ? "border-lagoon-deep bg-lagoon/10"
            : "border-border/70 bg-muted/20 hover:border-lagoon-deep/50",
          disabled && "pointer-events-none opacity-70",
        )}
      >
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-lagoon-deep/10">
            {disabled ? (
              <Loader2 className="size-7 animate-spin text-lagoon-deep" />
            ) : (
              <Upload className="size-7 text-lagoon-deep" />
            )}
          </div>
          <p className="text-base font-semibold text-foreground">
            {loadingSaved
              ? "Loading saved imports…"
              : busy
                ? "Reading your file…"
                : "Drop your timetable here"}
          </p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            CSV or Excel (.csv, .xlsx, .xls). We detect columns like Start, End,
            Title, Module code, and Type.
          </p>
          {!isEmpty ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="mt-4"
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation();
                inputRef.current?.click();
              }}
            >
              Choose file
            </Button>
          ) : null}
        </div>

        <div
          className={cn(
            "mt-6 grid gap-3 text-left",
            isEmpty ? "sm:grid-cols-3" : "sm:grid-cols-2",
          )}
        >
          <FormatHint
            icon={FileSpreadsheet}
            title="CSV — recommended"
            detail="Export from your portal as CSV for the most reliable import."
            recommended
          />
          <FormatHint
            icon={FileSpreadsheet}
            title="Excel"
            detail="Campus timetables saved as .xlsx or .xls work too."
          />
          {isEmpty ? (
            <FormatHint
              icon={FileText}
              title="PDF timetables"
              detail="Save as CSV from Excel or your portal first — PDF cannot be parsed yet."
              muted
            />
          ) : null}
        </div>
      </div>

      {isEmpty ? (
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button
            size="lg"
            className="h-12 min-w-44 gap-2 rounded-xl"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="size-4" />
            Choose file
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="h-12 min-w-44 gap-2 rounded-xl"
            disabled={disabled}
            onClick={onSampleDownload}
          >
            <Download className="size-4" />
            Sample CSV
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function FormatHint({
  icon: Icon,
  title,
  detail,
  recommended,
  muted,
}: {
  icon: typeof FileSpreadsheet;
  title: string;
  detail: string;
  recommended?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card/80 p-3 text-sm",
        recommended && "border-lagoon-deep/30 bg-lagoon/5",
        muted && "border-border/50 opacity-90",
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex gap-2">
        <Icon
          className={cn(
            "mt-0.5 size-4 shrink-0",
            recommended ? "text-lagoon-deep" : "text-muted-foreground",
          )}
        />
        <div>
          <p className="font-medium leading-snug">{title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {detail}
          </p>
        </div>
      </div>
    </div>
  );
}
