import { Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table";
import type { LecturerPendingClaimDTO } from "#/server-actions/lecturer-dashboard";

export function PendingVerificationTable({
  claims,
  emptyMessage,
}: {
  claims: LecturerPendingClaimDTO[];
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
          <TableHead>Tutor</TableHead>
          <TableHead>Module</TableHead>
          <TableHead>Hours</TableHead>
          <TableHead>Evidence</TableHead>
          <TableHead>Submitted</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {claims.map((claim) => (
          <TableRow key={claim.id}>
            <TableCell className="font-medium">
              {claim.tutor?.id ? (
                <Link
                  to="/lecturer/tutors"
                  search={{ tutor: claim.tutor.id }}
                  className="hover:underline"
                >
                  {claim.tutor.full_name}
                </Link>
              ) : (
                (claim.tutor?.full_name ?? "—")
              )}
            </TableCell>
            <TableCell>{claim.module?.code ?? "—"}</TableCell>
            <TableCell>{claim.hours}</TableCell>
            <TableCell>
              {claim.evidenceCount > 0 ? (
                <span className="text-sm text-foreground">
                  {claim.evidenceCount} file
                  {claim.evidenceCount === 1 ? "" : "s"}
                  {claim.evidencePreview[0] ? (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {claim.evidencePreview[0].original_filename}
                    </span>
                  ) : null}
                </span>
              ) : (
                <span className="text-sm text-amber-700">None uploaded</span>
              )}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {claim.submitted_at
                ? format(parseISO(claim.submitted_at), "dd MMM yyyy, HH:mm")
                : format(parseISO(claim.session_date), "dd MMM yyyy")}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
