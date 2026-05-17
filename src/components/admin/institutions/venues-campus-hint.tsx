import { Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";

export function VenuesCampusHint() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="size-4 text-muted-foreground" />
          Venues &amp; campuses
        </CardTitle>
        <CardDescription>
          Link venues to campuses when creating or editing schedules.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Campus records defined here can be assigned to venues on the schedules
          page. Lecturer schedule tools continue to use venue text and module
          semester fields until a future sync with academic terms.
        </p>
        <Link
          to="/admin/schedules"
          className="mt-3 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Manage schedules &amp; venues
        </Link>
      </CardContent>
    </Card>
  );
}
