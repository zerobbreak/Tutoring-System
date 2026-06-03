import { Badge } from "#/components/ui/badge";
import { WorkflowMessageButton } from "#/components/messaging/workflow-message-button";
import { claimBadgeLabel, claimBadgeVariant } from "#/lib/session-claim-display";
import type { LecturerSessionDetailDTO } from "#/server-actions/lecturer-sessions";

type LecturerSessionDetailSheetHeaderProps = {
  session: LecturerSessionDetailDTO;
};

export function LecturerSessionDetailSheetHeader({ session }: LecturerSessionDetailSheetHeaderProps) {
  return (
    <div className="shrink-0 border-b bg-linear-to-br from-(--lagoon-deep)/10 via-background to-background px-6 py-5">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold tracking-tight">
          {session.tutor?.full_name ?? "Tutor"}
        </h2>
        <p className="mt-0.5 text-sm leading-snug text-muted-foreground">
          <span className="font-medium text-foreground">{session.module?.code}</span>
          {" — "}
          {session.module?.name}
        </p>
        <div className="mt-2.5">
          <Badge variant={claimBadgeVariant(session.status)}>
            {claimBadgeLabel(session.status)}
          </Badge>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <WorkflowMessageButton kind="session" claimId={session.id} />
        <WorkflowMessageButton kind="attendance" claimId={session.id} />
        <WorkflowMessageButton kind="claim" claimId={session.id} />
      </div>
    </div>
  );
}
