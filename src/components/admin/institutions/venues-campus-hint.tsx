import { Link } from "@tanstack/react-router";
import { APP_PATHS } from "#/lib/app-paths";
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
          Manage venues and link them to campuses and schedules.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Create and manage venues on the dedicated venues page. Venues can be
          assigned to campuses and linked to schedule series for conflict
          detection.
        </p>
        <Link
          to={APP_PATHS.admin.venues}
          className="mt-3 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Manage venues →
        </Link>
      </CardContent>
    </Card>
  );
}
