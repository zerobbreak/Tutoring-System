import { lazy } from "react";
import { LazyWhenOpened } from "#/lib/lazy-when-opened";
import type { TutorSessionClaimDTO } from "#/server-actions/tutor-sessions";

const SubmitClaimDialog = lazy(() =>
  import("#/components/tutor/sessions/submit-claim-dialog").then((m) => ({
    default: m.SubmitClaimDialog,
  })),
);
const TutorDiscardDraftsDialog = lazy(() =>
  import("#/components/tutor/sessions/tutor-discard-drafts-dialog").then(
    (m) => ({ default: m.TutorDiscardDraftsDialog }),
  ),
);
const TutorRequestSessionDialog = lazy(() =>
  import("#/components/tutor/sessions/tutor-request-session-dialog").then(
    (m) => ({ default: m.TutorRequestSessionDialog }),
  ),
);
const TutorSessionAttendanceDialog = lazy(() =>
  import("#/components/tutor/sessions/tutor-session-attendance-dialog").then(
    (m) => ({ default: m.TutorSessionAttendanceDialog }),
  ),
);
const TutorSessionQrDialog = lazy(() =>
  import("#/components/tutor/sessions/tutor-session-qr-dialog").then((m) => ({
    default: m.TutorSessionQrDialog,
  })),
);
const TutorSessionRegisterUploadDialog = lazy(() =>
  import(
    "#/components/tutor/sessions/tutor-session-register-upload-dialog"
  ).then((m) => ({ default: m.TutorSessionRegisterUploadDialog })),
);
const TutorSessionWorkspaceDialog = lazy(() =>
  import("#/components/tutor/sessions/tutor-session-workspace-dialog").then(
    (m) => ({ default: m.TutorSessionWorkspaceDialog }),
  ),
);
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
      <LazyWhenOpened open={detailOpen}>
        <TutorSessionWorkspaceDialog
          open={detailOpen}
          claim={detailClaim}
          onOpenChange={onDetailOpenChange}
          onSubmit={onSubmitClaim}
          onDiscard={onDiscardClaim}
        />
      </LazyWhenOpened>

      <LazyWhenOpened open={qrOpen}>
        <TutorSessionQrDialog
          open={qrOpen}
          onOpenChange={onQrOpenChange}
          claim={qrClaim}
        />
      </LazyWhenOpened>

      <LazyWhenOpened open={uploadOpen}>
        <TutorSessionRegisterUploadDialog
          open={uploadOpen}
          onOpenChange={onUploadOpenChange}
          claim={uploadClaim}
          onUploaded={onRefresh}
        />
      </LazyWhenOpened>

      <LazyWhenOpened open={attendanceOpen}>
        <TutorSessionAttendanceDialog
          open={attendanceOpen}
          onOpenChange={onAttendanceOpenChange}
          claim={attendanceClaim}
          onUpdated={onRefresh}
        />
      </LazyWhenOpened>

      <LazyWhenOpened open={submitOpen}>
        <SubmitClaimDialog
          claim={submitClaim}
          open={submitOpen}
          onOpenChange={onSubmitOpenChange}
          onSubmitted={onRefresh}
        />
      </LazyWhenOpened>

      <LazyWhenOpened open={discardOpen}>
        <TutorDiscardDraftsDialog
          open={discardOpen}
          onOpenChange={onDiscardOpenChange}
          targetIds={discardTargetIds}
          confirmClaim={confirmDiscardClaim}
          onDiscarded={onDiscarded}
        />
      </LazyWhenOpened>

      <LazyWhenOpened open={createOpen}>
        <TutorRequestSessionDialog
          open={createOpen}
          onOpenChange={onCreateOpenChange}
          resubmitClaim={resubmitClaim}
          onSaved={onRefresh}
        />
      </LazyWhenOpened>
    </>
  );
}
