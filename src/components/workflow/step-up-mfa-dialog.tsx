import { Shield } from "lucide-react";
import { useEffect, useState } from "react";
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
import { Label } from "#/components/ui/label";
import { SigningAs } from "#/components/workflow/signing-as";

type StepUpMfaDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  submitting?: boolean;
  /** This step signs the claim: show the saved signature and require one. */
  signing?: boolean;
  onConfirm: (code: string) => void | Promise<void>;
};

export function StepUpMfaDialog({
  open,
  onOpenChange,
  title = "Confirm with authenticator",
  description = "Enter the 6-digit code from your authenticator app to confirm this action.",
  confirmLabel = "Confirm",
  submitting = false,
  signing = false,
  onConfirm,
}: StepUpMfaDialogProps) {
  const [code, setCode] = useState("");
  const [signatureReady, setSignatureReady] = useState(false);
  const blockedBySignature = signing && !signatureReady;

  useEffect(() => {
    if (!open) setCode("");
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length < 6 || blockedBySignature) return;
    void onConfirm(code.trim());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-(--lagoon-deep)/10">
            <Shield className="size-5 text-(--lagoon-deep)" aria-hidden />
          </div>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {signing && open ? <SigningAs onReadyChange={setSignatureReady} /> : null}
          <div className="space-y-2">
            <Label htmlFor="step-up-mfa-code">Authenticator code</Label>
            <Input
              id="step-up-mfa-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="font-mono tracking-widest"
              disabled={submitting}
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || code.trim().length < 6 || blockedBySignature}
            >
              {submitting ? "Verifying…" : confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
