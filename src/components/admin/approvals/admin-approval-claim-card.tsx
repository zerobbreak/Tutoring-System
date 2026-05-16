import { formatDistanceToNow, parseISO } from "date-fns";
import { CheckCircle2, Snowflake, Users } from "lucide-react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "#/components/ui/card";
import type { AdminApprovalClaimCardDTO } from "#/server-actions/admin-approvals";

type AdminApprovalClaimCardProps = {
  claim: AdminApprovalClaimCardDTO;
  onReview: (claimId: string) => void;
};

function attendanceLabel(claim: AdminApprovalClaimCardDTO) {
  const present = claim.attendance_present_count;
  if (present != null) {
    return `${present} students`;
  }
  if (claim.attendance_scan_count > 0) {
    return `${claim.attendance_scan_count} QR scans`;
  }
  return "No attendance recorded";
}

function statusLine(claim: AdminApprovalClaimCardDTO) {
  if (claim.frozen_at) return "Frozen — under review";
  if (claim.status === "VERIFIED") return "Awaiting admin approval";
  if (claim.status === "DISPUTED") return "Disputed";
  if (claim.status === "APPROVED") return "Approved";
  return claim.status.replace(/_/g, " ").toLowerCase();
}

export function AdminApprovalClaimCard({
  claim,
  onReview,
}: AdminApprovalClaimCardProps) {
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
              {claim.tutor?.full_name ?? "Unknown tutor"}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {claim.frozen_at ? (
              <Badge variant="outline" className="gap-1">
                <Snowflake className="size-3" />
                Frozen
              </Badge>
            ) : null}
            {claim.lecturer_verified && claim.status === "VERIFIED" ? (
              <Badge
                variant="secondary"
                className="gap-1 bg-emerald-50 text-emerald-800"
              >
                <CheckCircle2 className="size-3" />
                Lecturer verified
              </Badge>
            ) : null}
          </div>
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
          <span className="font-medium">{attendanceLabel(claim)}</span>
        </div>
        <p className="text-xs font-medium text-amber-800">{statusLine(claim)}</p>
        {submittedLabel ? (
          <p className="text-xs text-muted-foreground">Submitted {submittedLabel}</p>
        ) : null}
      </CardContent>
      <CardFooter className="pt-0">
        <Button size="sm" className="w-full" onClick={() => onReview(claim.id)}>
          Review
        </Button>
      </CardFooter>
    </Card>
  );
}
