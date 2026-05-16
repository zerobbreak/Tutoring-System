import { Link } from "@tanstack/react-router";
import { formatDistanceToNow, parseISO } from "date-fns";
import { FileText, Users } from "lucide-react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "#/components/ui/card";
import { formatClaimStatus } from "#/lib/session-claim-display";
import type { VerificationClaimCardDTO } from "#/server-actions/lecturer-verification";

type VerificationClaimCardProps = {
  claim: VerificationClaimCardDTO;
  onReview: (claimId: string) => void;
};

function attendanceLabel(claim: VerificationClaimCardDTO) {
  const present = claim.attendance_present_count;
  const expected = claim.attendance_expected_count;
  if (present != null && expected != null) {
    return `${present} / ${expected} students`;
  }
  if (present != null) {
    return `${present} students`;
  }
  if (claim.attendance_scan_count > 0) {
    return `${claim.attendance_scan_count} QR scans`;
  }
  return "No attendance recorded";
}

export function VerificationClaimCard({
  claim,
  onReview,
}: VerificationClaimCardProps) {
  const submittedLabel = claim.submitted_at
    ? formatDistanceToNow(parseISO(claim.submitted_at), { addSuffix: true })
    : null;

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm text-muted-foreground">Tutor</p>
            <p className="font-semibold text-foreground">
              {claim.tutor?.id ? (
                <Link
                  to="/lecturer/tutors"
                  search={{ tutor: claim.tutor.id }}
                  className="hover:underline"
                >
                  {claim.tutor.full_name}
                </Link>
              ) : (
                (claim.tutor?.full_name ?? "Unknown tutor")
              )}
            </p>
          </div>
          <Badge variant="secondary">{formatClaimStatus(claim.status)}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Module</span>
          <span className="font-medium">{claim.module?.code ?? "—"}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Hours</span>
          <span className="font-medium">{claim.hours}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Users className="size-3.5" />
            Attendance
          </span>
          <span className="text-right font-medium">{attendanceLabel(claim)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1 text-muted-foreground">
            <FileText className="size-3.5" />
            Evidence
          </span>
          <span className="font-medium">
            {claim.evidence_count > 0
              ? `${claim.evidence_count} file${claim.evidence_count === 1 ? "" : "s"}`
              : "None"}
          </span>
        </div>
        {submittedLabel ? (
          <p className="pt-1 text-xs text-muted-foreground">
            Submitted {submittedLabel}
          </p>
        ) : null}
      </CardContent>
      <CardFooter className="pt-0">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => onReview(claim.id)}
        >
          Review claim
        </Button>
      </CardFooter>
    </Card>
  );
}
