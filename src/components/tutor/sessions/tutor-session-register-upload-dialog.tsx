import { Loader2, Upload } from "lucide-react";
import { useState } from "react";
import { Button } from "#/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { fileToBase64 } from "#/lib/file-base64";
import { toast } from "#/lib/toast";
import { registerAttendanceEvidenceFn } from "#/server-actions/tutor-sessions";
import type { TutorSessionClaimDTO } from "#/server-actions/tutor-sessions";

export function TutorSessionRegisterUploadDialog({
  open,
  onOpenChange,
  claim,
  onUploaded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  claim: TutorSessionClaimDTO | null;
  onUploaded: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload register</DialogTitle>
          <DialogDescription>
            Attach a class register or attendance sheet (max 12MB).
          </DialogDescription>
        </DialogHeader>
        {claim ? (
          <form
            className="space-y-3"
            onSubmit={async (ev) => {
              ev.preventDefault();
              const fd = new FormData(ev.currentTarget);
              const file = fd.get("file");
              if (!(file instanceof File) || file.size === 0) {
                toast.error("Choose a file first.");
                return;
              }
              setBusy(true);
              try {
                const b64 = await fileToBase64(file);
                await registerAttendanceEvidenceFn({
                  data: {
                    claimId: claim.id,
                    fileBase64: b64,
                    fileName: file.name,
                    mimeType: file.type || "application/octet-stream",
                  },
                });
                toast.success("Register uploaded");
                onOpenChange(false);
                await onUploaded();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Upload failed");
              } finally {
                setBusy(false);
              }
            }}
          >
            <Input name="file" type="file" required />
            <DialogFooter>
              <Button type="submit" disabled={busy}>
                {busy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Uploading
                  </>
                ) : (
                  <>
                    <Upload className="size-4" />
                    Upload
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
