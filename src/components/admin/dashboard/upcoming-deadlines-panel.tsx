import { format, parseISO } from "date-fns";
import { CalendarClock } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { Skeleton } from "#/components/ui/skeleton";
import type { AdminDeadlineDTO } from "#/server-actions/admin-dashboard";

type UpcomingDeadlinesPanelProps = {
  booting: boolean;
  deadlines: AdminDeadlineDTO[];
};

export function UpcomingDeadlinesPanel({
  booting,
  deadlines,
}: UpcomingDeadlinesPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="size-4 text-muted-foreground" />
          Upcoming deadlines
        </CardTitle>
        <CardDescription>Sessions and items needing attention</CardDescription>
      </CardHeader>
      <CardContent>
        {booting ? (
          <Skeleton className="h-20 w-full" />
        ) : deadlines.length === 0 ? (
          <p className="text-sm text-muted-foreground">No urgent deadlines.</p>
        ) : (
          <ul className="space-y-2">
            {deadlines.map((item) => (
              <li
                key={item.id}
                className="rounded-md border border-border/60 px-3 py-2 text-sm"
              >
                <p>{item.label}</p>
                {item.at ? (
                  <p className="text-xs text-muted-foreground">
                    {format(parseISO(item.at), "dd MMM yyyy")}
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
