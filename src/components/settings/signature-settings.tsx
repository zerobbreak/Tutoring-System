import { format, parseISO } from "date-fns";
import { Loader2, PenLine } from "lucide-react";
import { useState } from "react";
import { Button } from "#/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { Skeleton } from "#/components/ui/skeleton";
import { SignaturePad } from "#/components/workflow/signature-pad";
import { useMySignature } from "#/components/workflow/use-my-signature";
import { toast } from "#/lib/toast";
import { saveMySignatureFn } from "#/server-actions/claim-signatures";

/** Draw the signature once; it is reused whenever you sign a claim step. */
export function SignatureSettings() {
  const signature = useMySignature();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const showPad = editing || (!signature.isLoading && !signature.data);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await saveMySignatureFn({ data: { imageDataUrl: draft } });
      await signature.invalidate();
      setEditing(false);
      setDraft(null);
      toast.success("Signature saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save signature");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PenLine className="size-4 text-[var(--lagoon)]" />
          Signature
        </CardTitle>
        <CardDescription>
          Draw it once. It is added to a claim each time you submit, verify or
          approve it, together with your authenticator code. Claims you already
          signed keep the signature they were signed with.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {signature.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : showPad ? (
          <>
            <SignaturePad onChange={setDraft} disabled={saving} />
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void save()} disabled={!draft || saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                Save signature
              </Button>
              {signature.data ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditing(false);
                    setDraft(null);
                  }}
                  disabled={saving}
                >
                  Cancel
                </Button>
              ) : null}
            </div>
          </>
        ) : signature.data ? (
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-24 w-64 items-center justify-center rounded-lg border bg-white px-3">
              <img
                src={signature.data.imageDataUrl}
                alt="Your saved signature"
                className="max-h-20 max-w-full object-contain"
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Saved {format(parseISO(signature.data.updatedAt), "d MMM yyyy")}
              </p>
              <Button type="button" variant="outline" onClick={() => setEditing(true)}>
                Draw a new signature
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
