import { useState } from "react";
import { ChevronDown, ChevronUp, Info } from "lucide-react";
import { Button } from "#/components/ui/button";
import type { ScheduleParseRowIssue } from "#/lib/schedule-spreadsheet";
import { cn } from "#/lib/utils";

type TutorScheduleParseAlertProps = {
  issues: ScheduleParseRowIssue[];
};

export function TutorScheduleParseAlert({ issues }: TutorScheduleParseAlertProps) {
  const [expanded, setExpanded] = useState(issues.length <= 3);
  if (issues.length === 0) return null;

  const visible = expanded ? issues : issues.slice(0, 3);

  return (
    <div className="mx-4 mb-3 rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 dark:border-amber-900/50 dark:bg-amber-950/25 md:mx-6">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
          <Info className="size-4 shrink-0" />
          <span className="text-xs font-medium uppercase tracking-wide">
            Import notes ({issues.length})
          </span>
        </div>
        {issues.length > 3 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs text-amber-900 hover:bg-amber-100/80 dark:text-amber-100"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? (
              <>
                Show less <ChevronUp className="size-3.5" />
              </>
            ) : (
              <>
                Show all <ChevronDown className="size-3.5" />
              </>
            )}
          </Button>
        ) : null}
      </div>
      <ul className={cn("mt-2 space-y-1", !expanded && issues.length > 3 && "")}>
        {visible.map((issue, i) => (
          <li
            key={i}
            className="text-[11px] leading-relaxed text-amber-900/85 dark:text-amber-100/85"
          >
            Row {issue.rowNumber}: {issue.message}
          </li>
        ))}
        {!expanded && issues.length > 3 ? (
          <li className="text-[10px] text-amber-800/70 dark:text-amber-200/70">
            + {issues.length - 3} more (expand to view)
          </li>
        ) : null}
      </ul>
    </div>
  );
}
