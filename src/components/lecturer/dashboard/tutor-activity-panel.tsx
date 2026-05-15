import { format, parseISO } from "date-fns";
import { Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import type { LecturerActivityItemDTO } from "#/server-actions/lecturer-dashboard";
import { activityIcon } from "./activity-icon";

type TutorActivityPanelProps = {
  booting: boolean;
  activityFeed: LecturerActivityItemDTO[];
};

export function TutorActivityPanel({
  booting,
  activityFeed,
}: TutorActivityPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tutor activity</CardTitle>
        <CardDescription>Recent events on your modules</CardDescription>
      </CardHeader>
      <CardContent>
        {booting ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : activityFeed.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No recent tutor activity.
          </p>
        ) : (
          <ul className="space-y-3">
            {activityFeed.map((item) => {
              const Icon = activityIcon(item.kind);
              return (
                <li
                  key={item.id}
                  className="flex gap-3 border-b border-border/60 pb-3 last:border-0 last:pb-0"
                >
                  <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug">{item.message}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {format(parseISO(item.at), "dd MMM yyyy, HH:mm")}
                      {item.moduleCode ? ` · ${item.moduleCode}` : ""}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
