import { QRCodeSVG } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import type { TutorSessionClaimDTO } from "#/server-actions/tutor-sessions";

export function TutorSessionQrDialog({
  open,
  onOpenChange,
  claim,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  claim: TutorSessionClaimDTO | null;
}) {
  const sessionQrValue =
    typeof window !== "undefined" && claim
      ? `${window.location.origin}/tutor/sessions?claim=${claim.id}`
      : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Session QR</DialogTitle>
          <DialogDescription>
            Scan to return tutors straight to this session workspace.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 py-2">
          {claim ? (
            <>
              <div className="rounded-lg border bg-white p-3">
                <QRCodeSVG value={sessionQrValue} size={180} level="M" />
              </div>
              <p className="break-all text-center text-xs text-muted-foreground">
                {sessionQrValue}
              </p>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
