import { SubmitClaimDialog } from "#/components/tutor/sessions/submit-claim-dialog";
import { TutorDiscardDraftsDialog } from "#/components/tutor/sessions/tutor-discard-drafts-dialog";
import { TutorRequestSessionDialog } from "#/components/tutor/sessions/tutor-request-session-dialog";
import { TutorSessionAttendanceDialog } from "#/components/tutor/sessions/tutor-session-attendance-dialog";
import { TutorSessionQrDialog } from "#/components/tutor/sessions/tutor-session-qr-dialog";
import { TutorSessionRegisterUploadDialog } from "#/components/tutor/sessions/tutor-session-register-upload-dialog";
import { TutorSessionWorkspaceDialog } from "#/components/tutor/sessions/tutor-session-workspace-dialog";
import type { TutorSessionClaimDTO } from "#/server-actions/tutor-sessions";

type TutorSessionsWorkspaceDialogsProps = {
  detailOpen: boolean;
  detailClaim: TutorSessionClaimDTO | null;
  qrOpen: boolean;
  qrClaim: TutorSessionClaimDTO | null;
  uploadOpen: boolean;
  uploadClaim: TutorSessionClaimDTO | null;
  attendanceOpen: boolean;
  attendanceClaim: TutorSessionClaimDTO | null;
  submitOpen: boolean;
  submitClaim: TutorSessionClaimDTO | null;
  createOpen: boolean;
  resubmitClaim: TutorSessionClaimDTO | null;
  discardOpen: boolean;
  discardTargetIds: string[];
  onDetailOpenChange: (open: boolean) => void;
  onQrOpenChange: (open: boolean) => void;
  onUploadOpenChange: (open: boolean) => void;
  onAttendanceOpenChange: (open: boolean) => void;
  onSubmitOpenChange: (open: boolean) => void;
  onCreateOpenChange: (open: boolean) => void;
  onDiscardOpenChange: (open: boolean) => void;
  onDiscarded: (ids: string[]) => Promise<void>;
  onRefresh: () => void;
  onSubmitClaim: (claim: TutorSessionClaimDTO) => void;
  onDiscardClaim: (claimId: string) => void;
  confirmDiscardClaim: TutorSessionClaimDTO | null;
};

export function TutorSessionsWorkspaceDialogs({
  detailOpen,
  detailClaim,
  qrOpen,
  qrClaim,
  uploadOpen,
  uploadClaim,
  attendanceOpen,
  attendanceClaim,
  submitOpen,
  submitClaim,
  createOpen,
  resubmitClaim,
  discardOpen,
  discardTargetIds,
  onDetailOpenChange,
  onQrOpenChange,
  onUploadOpenChange,
  onAttendanceOpenChange,
  onSubmitOpenChange,
  onCreateOpenChange,
  onDiscardOpenChange,
  onDiscarded,
  onRefresh,
  onSubmitClaim,
  onDiscardClaim,
  confirmDiscardClaim,
}: TutorSessionsWorkspaceDialogsProps) {
  return (
    <>
      <TutorSessionWorkspaceDialog
        open={detailOpen}
        claim={detailClaim}
        onOpenChange={onDetailOpenChange}
        onSubmit={onSubmitClaim}
        onDiscard={onDiscardClaim}
      />

      <TutorSessionQrDialog open={qrOpen} onOpenChange={onQrOpenChange} claim={qrClaim} />

      <TutorSessionRegisterUploadDialog
        open={uploadOpen}
        onOpenChange={onUploadOpenChange}
        claim={uploadClaim}
        onUploaded={onRefresh}
      />

      <TutorSessionAttendanceDialog
        open={attendanceOpen}
        onOpenChange={onAttendanceOpenChange}
        claim={attendanceClaim}
        onUpdated={onRefresh}
      />

      <SubmitClaimDialog
        claim={submitClaim}
        open={submitOpen}
        onOpenChange={onSubmitOpenChange}
        onSubmitted={onRefresh}
      />

      <TutorDiscardDraftsDialog
        open={discardOpen}
        onOpenChange={onDiscardOpenChange}
        targetIds={discardTargetIds}
        confirmClaim={confirmDiscardClaim}
        onDiscarded={onDiscarded}
      />

      <TutorRequestSessionDialog
        open={createOpen}
        onOpenChange={onCreateOpenChange}
        resubmitClaim={resubmitClaim}
        onSaved={onRefresh}
      />
    </>
  );
}
