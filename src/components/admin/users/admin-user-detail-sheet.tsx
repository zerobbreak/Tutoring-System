import { format, parseISO } from "date-fns";
import { ExternalLink, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "#/components/ui/sheet";
import {
  ONBOARDING_DOCUMENT_LABELS,
  formatApprovalStatus,
} from "#/lib/onboarding-documents";
import { formatRoleLabel, USER_ROLES, type UserRole } from "#/lib/user-role";
import { toast } from "#/lib/toast";
import {
  assignModuleLecturerFn,
  getAdminUserDetailFn,
  listInstitutionModulesFn,
  resetUserMfaFn,
  reviewOnboardingFn,
  setUserActiveFn,
  updateUserRoleFn,
  type AdminUserDetailDTO,
  type InstitutionModuleOptionDTO,
} from "#/server-actions/admin-users";

const selectContentProps = {
  position: "popper" as const,
  sideOffset: 4,
  className: "z-[100] max-h-60",
};

type AdminUserDetailSheetProps = {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onActionComplete: () => void;
};

export function AdminUserDetailSheet({
  userId,
  open,
  onOpenChange,
  onActionComplete,
}: AdminUserDetailSheetProps) {
  const [detail, setDetail] = useState<AdminUserDetailDTO | null>(null);
  const [modules, setModules] = useState<InstitutionModuleOptionDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState("");
  const [role, setRole] = useState<UserRole>("TUTOR");
  const [moduleId, setModuleId] = useState("");

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [userDetail, modList] = await Promise.all([
        getAdminUserDetailFn({ data: { userId } }),
        listInstitutionModulesFn(),
      ]);
      setDetail(userDetail);
      setModules(modList.modules);
      setRole(userDetail.user.role);
      setNote("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load user");
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }, [userId, onOpenChange]);

  useEffect(() => {
    if (open && userId) void load();
    else setDetail(null);
  }, [open, userId, load]);

  const run = async (fn: () => Promise<unknown>, success: string) => {
    setSubmitting(true);
    try {
      await fn();
      toast.success(success);
      onActionComplete();
      if (userId) await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setSubmitting(false);
    }
  };

  const user = detail?.user;
  const canReview =
    user &&
    ["pending_documents", "pending_review"].includes(user.approval_status);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>User management</SheetTitle>
          <SheetDescription>
            Roles, onboarding, MFA, and module assignment.
          </SheetDescription>
        </SheetHeader>

        {loading || !user ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="mt-6 space-y-6 pb-8">
            <div>
              <h3 className="text-lg font-semibold">{user.full_name}</h3>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge>{formatRoleLabel(user.role)}</Badge>
                <Badge variant="outline">
                  {formatApprovalStatus(user.approval_status)}
                </Badge>
                {!user.is_active ? (
                  <Badge variant="destructive">Disabled</Badge>
                ) : null}
              </div>
            </div>

            {detail.documents.length > 0 ? (
              <div className="space-y-2">
                <Label>Submitted documents</Label>
                <ul className="space-y-2 text-sm">
                  {detail.documents.map((doc) => (
                    <li
                      key={doc.id}
                      className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                    >
                      <span>
                        {ONBOARDING_DOCUMENT_LABELS[doc.document_kind]} —{" "}
                        {doc.file_name}
                      </span>
                      {doc.download_url ? (
                        <a
                          href={doc.download_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          View
                          <ExternalLink className="size-3" />
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {canReview ? (
              <div className="space-y-3 rounded-lg border border-amber-200/80 bg-amber-50/50 p-4">
                <Label htmlFor="review-note">Review note (optional)</Label>
                <Input
                  id="review-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Internal note"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={submitting}
                    onClick={() =>
                      void run(
                        () =>
                          reviewOnboardingFn({
                            data: {
                              userId: user.id,
                              decision: "approve",
                              note: note.trim() || undefined,
                            },
                          }),
                        "User approved.",
                      )
                    }
                  >
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={submitting}
                    onClick={() =>
                      void run(
                        () =>
                          reviewOnboardingFn({
                            data: {
                              userId: user.id,
                              decision: "reject",
                              note: note.trim() || undefined,
                            },
                          }),
                        "User rejected.",
                      )
                    }
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>Role</Label>
              <div className="flex gap-2">
                <Select
                  value={role}
                  onValueChange={(v) => setRole(v as UserRole)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent {...selectContentProps}>
                    {USER_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {formatRoleLabel(r)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  disabled={submitting || role === user.role}
                  onClick={() =>
                    void run(
                      () =>
                        updateUserRoleFn({
                          data: { userId: user.id, role },
                        }),
                      "Role updated.",
                    )
                  }
                >
                  Save
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={submitting}
                onClick={() =>
                  void run(
                    () =>
                      setUserActiveFn({
                        data: {
                          userId: user.id,
                          is_active: !user.is_active,
                        },
                      }),
                    user.is_active ? "Account disabled." : "Account enabled.",
                  )
                }
              >
                {user.is_active ? "Disable account" : "Enable account"}
              </Button>
              <Button
                variant="outline"
                disabled={submitting || !user.mfa_enabled}
                onClick={() =>
                  void run(
                    () => resetUserMfaFn({ data: { userId: user.id } }),
                    "MFA reset.",
                  )
                }
              >
                Reset MFA
              </Button>
            </div>

            {user.role === "LECTURER" ? (
              <div className="space-y-2">
                <Label>Assign module ownership</Label>
                <p className="text-xs text-muted-foreground">
                  Currently owns {detail.modules_as_lecturer.length} module(s)
                  · {detail.active_tutor_assignments} active tutor assignment(s)
                </p>
                <div className="flex gap-2">
                  <Select value={moduleId} onValueChange={setModuleId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select module" />
                    </SelectTrigger>
                    <SelectContent {...selectContentProps}>
                      {modules.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.code} — {m.name}
                          {m.lecturer_name ? ` (${m.lecturer_name})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    disabled={submitting || !moduleId}
                    onClick={() =>
                      void run(
                        () =>
                          assignModuleLecturerFn({
                            data: {
                              moduleId,
                              lecturerUserId: user.id,
                            },
                          }),
                        "Module lecturer assigned.",
                      )
                    }
                  >
                    Assign
                  </Button>
                </div>
                {detail.modules_as_lecturer.length > 0 ? (
                  <ul className="text-sm text-muted-foreground">
                    {detail.modules_as_lecturer.map((m) => (
                      <li key={m.id}>
                        {m.code} — {m.name}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            <p className="text-xs text-muted-foreground">
              Joined{" "}
              {user.created_at
                ? format(parseISO(user.created_at), "PP")
                : "—"}
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
