import { MapPin, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { Badge } from "#/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table";
import { venueAccessControlLabel } from "#/lib/venue-access";
import type { CampusDTO } from "#/server-actions/admin-institutions";
import type { AdminVenueDTO } from "#/server-actions/admin-venues";
import { VenueDialog } from "./venue-dialog";

type AdminVenuesViewProps = {
  venues: AdminVenueDTO[];
  campuses: CampusDTO[];
  loadError: string | null;
  onRetryLoad?: () => void;
  retryingLoad?: boolean;
  onRefresh: () => void;
};

export function AdminVenuesView({
  venues,
  campuses,
  loadError,
  onRetryLoad,
  retryingLoad,
  onRefresh,
}: AdminVenuesViewProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminVenueDTO | null>(null);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (venue: AdminVenueDTO) => {
    setEditing(venue);
    setDialogOpen(true);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain p-6 pb-10 md:p-8">
        <header className="flex shrink-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <MapPin className="size-7 text-(--lagoon-deep)" />
              Venues
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Manage session locations. Tag computer rooms that require staff to
              unlock facial-recognition doors.
            </p>
          </div>
          <Button onClick={openCreate} className="shrink-0">
            <Plus className="mr-2 size-4" />
            Add venue
          </Button>
        </header>

        {loadError ? (
          <QueryErrorBanner
            message={loadError}
            onRetry={onRetryLoad}
            retrying={retryingLoad}
          />
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">All venues</CardTitle>
            <CardDescription>
              {venues.length} venue{venues.length === 1 ? "" : "s"} in your
              institution
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {venues.length === 0 ? (
              <p className="px-6 py-8 text-sm text-muted-foreground">
                No venues yet. Add one to assign locations to schedules.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Access</TableHead>
                    <TableHead>Campus</TableHead>
                    <TableHead>Schedules</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {venues.map((venue) => (
                    <TableRow key={venue.id}>
                      <TableCell className="font-medium">{venue.name}</TableCell>
                      <TableCell>{venue.code ?? "—"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            venue.accessControl === "FACIAL_RECOGNITION"
                              ? "default"
                              : "outline"
                          }
                          className={
                            venue.accessControl === "FACIAL_RECOGNITION"
                              ? "bg-amber-600 text-white hover:bg-amber-600"
                              : undefined
                          }
                        >
                          {venueAccessControlLabel(venue.accessControl)}
                        </Badge>
                      </TableCell>
                      <TableCell>{venue.campusName ?? "—"}</TableCell>
                      <TableCell>{venue.activeScheduleCount}</TableCell>
                      <TableCell>
                        {venue.isActive ? (
                          <Badge variant="outline">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${venue.name}`}
                          onClick={() => openEdit(venue)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <VenueDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        campuses={campuses}
        onSaved={onRefresh}
      />
    </div>
  );
}
