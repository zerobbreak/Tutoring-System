import { useQuery } from "@tanstack/react-query";
import { Badge } from "#/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table";
import { queryKeys } from "#/lib/query-keys";
import { getVenueSchedulesFn } from "#/server-actions/admin-venues";

type VenueSchedulesPanelProps = {
  venueId: string;
  venueName: string;
};

export function VenueSchedulesPanel({
  venueId,
  venueName,
}: VenueSchedulesPanelProps) {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.admin.venueSchedules(venueId),
    queryFn: () => getVenueSchedulesFn({ data: { venueId } }),
  });

  const schedules = data?.schedules ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Schedules at {venueName}</CardTitle>
        <CardDescription>
          Active and draft schedule series assigned to this venue.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading schedules…</p>
        ) : schedules.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No schedules assigned to this venue.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Module</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Tutor</TableHead>
                <TableHead>Day</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules.map((schedule) => (
                <TableRow key={schedule.seriesId}>
                  <TableCell className="font-medium">
                    {schedule.moduleCode}
                  </TableCell>
                  <TableCell>{schedule.title}</TableCell>
                  <TableCell>{schedule.tutorName}</TableCell>
                  <TableCell>{schedule.dayOfWeek}</TableCell>
                  <TableCell>{schedule.startTime}</TableCell>
                  <TableCell>{schedule.durationMinutes} min</TableCell>
                  <TableCell>
                    {schedule.status === "PUBLISHED" ? (
                      <Badge
                        variant="secondary"
                        className="border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300"
                      >
                        Published
                      </Badge>
                    ) : (
                      <Badge variant="outline">Draft</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
