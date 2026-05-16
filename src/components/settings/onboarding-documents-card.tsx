import { useCallback, useEffect, useRef, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { fileToBase64 } from "#/lib/file-base64";
import {
  formatApprovalStatus,
  ONBOARDING_DOCUMENT_LABELS,
  type OnboardingDocumentKind,
} from "#/lib/onboarding-documents";
import { toast } from "#/lib/toast";
import {
  getOnboardingStatusFn,
  uploadOnboardingDocumentFn,
  type OnboardingStatusDTO,
} from "#/server-actions/settings/onboarding-documents";

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp";

export function OnboardingDocumentsCard() {
  const [status, setStatus] = useState<OnboardingStatusDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<OnboardingDocumentKind | null>(
    null,
  );
  const fileRefs = useRef<Partial<Record<OnboardingDocumentKind, HTMLInputElement>>>(
    {},
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getOnboardingStatusFn();
      setStatus(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load onboarding status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!status || status.approval_status === "approved") {
    return null;
  }

  const onPick = (kind: OnboardingDocumentKind) => {
    fileRefs.current[kind]?.click();
  };

  const onFile = async (kind: OnboardingDocumentKind, file: File | undefined) => {
    if (!file) return;
    setUploading(kind);
    try {
      const fileBase64 = await fileToBase64(file);
      const result = await uploadOnboardingDocumentFn({
        data: {
          documentKind: kind,
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          fileBase64,
        },
      });
      toast.success(
        result.pendingReview
          ? "All documents submitted. An administrator will review your application."
          : "Document uploaded.",
      );
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  };

  return (
    <Card className="border-amber-200/80 bg-amber-50/40">
      <CardHeader>
        <CardTitle className="text-lg">Institutional onboarding</CardTitle>
        <CardDescription>
          Submit required documents for administrator approval before using
          dashboards.
        </CardDescription>
        <Badge variant="secondary" className="w-fit">
          {formatApprovalStatus(status.approval_status)}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {!status.institution_id ? (
          <p className="text-sm text-muted-foreground">
            Select your institution in the account section below before uploading
            documents.
          </p>
        ) : (
          <>
            <ul className="space-y-3">
              {status.required_kinds.map((kind) => {
                const uploaded = status.documents.find(
                  (d) => d.document_kind === kind,
                );
                return (
                  <li
                    key={kind}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-background px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {ONBOARDING_DOCUMENT_LABELS[kind]}
                      </p>
                      {uploaded ? (
                        <p className="text-xs text-muted-foreground">
                          {uploaded.file_name} · submitted{" "}
                          {new Date(uploaded.submitted_at).toLocaleDateString()}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Not uploaded</p>
                      )}
                    </div>
                    <input
                      ref={(el) => {
                        if (el) fileRefs.current[kind] = el;
                      }}
                      type="file"
                      accept={ACCEPT}
                      className="sr-only"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        void onFile(kind, f);
                        e.target.value = "";
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant={uploaded ? "outline" : "default"}
                      disabled={
                        uploading !== null ||
                        status.approval_status === "rejected"
                      }
                      onClick={() => onPick(kind)}
                    >
                      {uploading === kind ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <FileUp className="size-4" />
                      )}
                      {uploaded ? "Replace" : "Upload"}
                    </Button>
                  </li>
                );
              })}
            </ul>
            {status.approval_status === "pending_review" ? (
              <p className="text-sm text-muted-foreground">
                Your documents are with an administrator. You will be notified
                when your account is approved.
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
