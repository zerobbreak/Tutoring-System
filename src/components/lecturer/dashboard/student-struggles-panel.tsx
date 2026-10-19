import { Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { Check, Eye, Lightbulb, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "#/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { QueryErrorBanner } from "#/components/ui/query-fetch-feedback";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";
import { Skeleton } from "#/components/ui/skeleton";
import { APP_PATHS } from "#/lib/app-paths";
import { formatQueryError } from "#/lib/query-error";
import { toast } from "#/lib/toast";
import {
  STUDENT_STRUGGLES_WINDOW_DAYS,
  type LecturerModuleDTO,
} from "#/server-actions/lecturer-dashboard";
import { useLecturerStudentStrugglesData } from "./use-lecturer-student-struggles-data";

/** Where students struggled, from tutors' shared notes on submitted claims. */
export function StudentStrugglesPanel({
  modules,
}: {
  modules: LecturerModuleDTO[];
}) {
  const [moduleId, setModuleId] = useState("all");
  const [markingId, setMarkingId] = useState<string | null>(null);
  const query = useLecturerStudentStrugglesData(
    moduleId === "all" ? undefined : moduleId,
  );
  const items = query.data ?? [];

  const markSeen = async (claimId: string) => {
    setMarkingId(claimId);
    try {
      await query.markSeen(claimId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not mark as seen");
    } finally {
      setMarkingId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="size-4 text-amber-600" />
            Student struggles
          </CardTitle>
          <CardDescription>
            What tutors report students found hard, last {STUDENT_STRUGGLES_WINDOW_DAYS / 7} weeks
          </CardDescription>
        </div>
        <Select value={moduleId} onValueChange={setModuleId}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="All modules" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All modules</SelectItem>
            {modules.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.code} — {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : query.error ? (
          <QueryErrorBanner
            message={formatQueryError(query.error) ?? "Could not load notes."}
            onRetry={() => void query.refetch()}
            retrying={query.isFetching}
          />
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No struggles reported on submitted sessions yet.
          </p>
        ) : (
          <ul className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
            {items.map((item) => (
              <li
                key={item.claim_id}
                className="rounded-md border border-border/70 px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    to={APP_PATHS.lecturer.sessions}
                    search={{ claim: item.claim_id }}
                    className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                  >
                    <span className="font-semibold text-lagoon-deep">
                      {item.module?.code ?? "Module"}
                    </span>{" "}
                    · {format(parseISO(`${item.session_date}T12:00:00`), "d MMM")}
                    {item.tutor_name ? ` · ${item.tutor_name}` : ""}
                  </Link>
                  {item.seen_at ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-300">
                      <Eye className="size-3" aria-hidden />
                      Seen
                    </span>
                  ) : (
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      className="gap-1"
                      disabled={markingId === item.claim_id}
                      onClick={() => void markSeen(item.claim_id)}
                    >
                      {markingId === item.claim_id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Check className="size-3" />
                      )}
                      Mark as seen
                    </Button>
                  )}
                </div>
                {item.student_struggles ? (
                  <p className="mt-1 whitespace-pre-wrap text-foreground">
                    {item.student_struggles}
                  </p>
                ) : null}
                {item.revision_topics ? (
                  <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                    <span className="font-medium">To review: </span>
                    {item.revision_topics}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
