export type ClaimStatus =
  | "DRAFT"
  | "PENDING_VERIFICATION"
  | "DISPUTED"
  | "REJECTED"
  | "VERIFIED"
  | "APPROVED";

export function formatClock(t: string | null | undefined): string {
  if (!t) return "—";
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!m) return t;
  return `${m[1]!.padStart(2, "0")}:${m[2]}`;
}

export function formatClaimStatus(s: ClaimStatus): string {
  return s.replace(/_/g, " ").toLowerCase();
}

export function claimBadgeLabel(status: ClaimStatus): string {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "PENDING_VERIFICATION":
      return "Pending verification";
    case "VERIFIED":
      return "Verified";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    case "DISPUTED":
      return "Disputed";
    default:
      return status;
  }
}

export function claimBadgeVariant(
  status: ClaimStatus,
): "success" | "warning" | "destructive" | "muted" | "secondary" {
  switch (status) {
    case "APPROVED":
    case "VERIFIED":
      return "success";
    case "PENDING_VERIFICATION":
      return "warning";
    case "REJECTED":
    case "DISPUTED":
      return "destructive";
    default:
      return "muted";
  }
}

export function notesStatusStyles(status: ClaimStatus): string {
  switch (status) {
    case "APPROVED":
    case "VERIFIED":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-800";
    case "PENDING_VERIFICATION":
      return "border-amber-500/30 bg-amber-500/10 text-amber-900";
    case "DISPUTED":
    case "REJECTED":
      return "border-destructive/30 bg-destructive/10 text-destructive";
    default:
      return "border-muted-foreground/30 bg-muted text-muted-foreground";
  }
}
