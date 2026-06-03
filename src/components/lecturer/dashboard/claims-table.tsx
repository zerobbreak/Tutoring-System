import { Link } from "@tanstack/react-router";
import { APP_PATHS } from "#/lib/app-paths";
import { format, parseISO } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table";
import type { LecturerClaimDTO } from "#/server-actions/lecturer-dashboard";
import { ClaimStatusBadge } from "./claim-status-badge";

export function ClaimsTable({
  claims,
  emptyMessage,
}: {
  claims: LecturerClaimDTO[];
  emptyMessage: string;
}) {
  if (!claims.length) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Module</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Hours</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {claims.map((claim) => (
          <TableRow key={claim.id}>
            <TableCell className="font-medium">
              <Link
                to={APP_PATHS.lecturer.sessions}
                search={{ claim: claim.id }}
                className="hover:underline"
              >
                {claim.module
                  ? `${claim.module.code} — ${claim.module.name}`
                  : "—"}
              </Link>
            </TableCell>
            <TableCell>
              {format(parseISO(claim.session_date), "dd MMM yyyy")}
            </TableCell>
            <TableCell>{claim.hours}</TableCell>
            <TableCell>
              <ClaimStatusBadge status={claim.status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
