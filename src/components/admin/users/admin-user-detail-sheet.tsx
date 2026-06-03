import {
  BookOpen,
  Calendar,
  ExternalLink,
  FileText,
  KeyRound,
  Loader2,
  Shield,
  UserCog,
} from "lucide-react";
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
  canReviewOnboarding,
} from "#/lib/onboarding-documents";
import { formatRoleLabel, USER_ROLES, type UserRole } from "#/lib/user-role";
import { cn } from "#/lib/utils";
import {
  assignModuleLecturerFn,
  reviewOnboardingFn,
  resetUserMfaFn,
  setUserActiveFn,
  updateUserRoleFn,
} from "#/server-actions/admin-users";
import { useAdminUserDetailSheet } from "#/components/admin/users/use-admin-user-detail-sheet";
import {
  DetailSection,
  selectContentProps,
  UserDetailHero,
} from "#/components/admin/users/admin-user-detail-sheet-sections";
import { AdminTutorHourAllocationsPanel } from "./admin-tutor-hour-allocations-panel";

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
  const {
    detail,
    modules,
    loading,
    submitting,
    note,
    setNote,
    role,
    setRole,
    moduleId,
    setModuleId,
    run,
  } = useAdminUserDetailSheet({
    userId,
    open,
    onOpenChange,
    onActionComplete,
  });

  const user = detail?.user;
  const canReview = user && canReviewOnboarding(user.user_status);
  const roleDirty = user ? role !== user.role : false;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <SheetHeader className="shrink-0 border-b px-6 py-4 pr-12">
          <SheetTitle className="text-base">User management</SheetTitle>
          <SheetDescription>
            Roles, onboarding, MFA, and module assignment.
          </SheetDescription>
        </SheetHeader>

        {loading || !user ? (
          <div className="flex flex-1 items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <UserDetailHero user={user} />

            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-6 py-5">
              {detail.documents.length > 0 ? (
                <DetailSection
                  title="Submitted documents"
                  description="Onboarding files uploaded by this user."
                  icon={FileText}
                >
                  <ul className="space-y-2">
                    {detail.documents.map((doc) => (
                      <li
                        key={doc.id}
                        className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-medium">
                            {ONBOARDING_DOCUMENT_LABELS[doc.document_kind]}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {doc.file_name}
                          </p>
                        </div>
                        {doc.download_url ? (
                          <a
                            href={doc.download_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-(--lagoon-deep) hover:underline"
                          >
                            View
                            <ExternalLink className="size-3" />
                          </a>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </DetailSection>
              ) : null}

              {canReview ? (
                <DetailSection
                  title="Onboarding review"
                  description="Approve or reject before the user can access the platform."
                  icon={Shield}
                  className="border-amber-200/80 bg-amber-50/40"
                >
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="review-note" className="text-xs">
                        Internal note (optional)
                      </Label>
                      <Input
                        id="review-note"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Reason or context for your decision"
                        className="bg-background"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        className="bg-(--lagoon-deep) text-white hover:bg-(--lagoon-deep)/90"
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
                </DetailSection>
              ) : null}

              <DetailSection
                title="Role"
                description="Controls dashboard access and permissions across the institution."
                icon={UserCog}
              >
                <div className="space-y-3">
                  <Select
                    value={role}
                    onValueChange={(v) => setRole(v as UserRole)}
                  >
                    <SelectTrigger className="w-full bg-background">
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
                    className={cn(
                      "w-full",
                      roleDirty &&
                        "bg-(--lagoon-deep) text-white hover:bg-(--lagoon-deep)/90",
                    )}
                    variant={roleDirty ? "default" : "outline"}
                    disabled={submitting || !roleDirty}
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
                    {roleDirty ? "Save role change" : "No changes to save"}
                  </Button>
                </div>
              </DetailSection>

              <DetailSection
                title="Account & security"
                description="Access control and multi-factor authentication."
                icon={KeyRound}
              >
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    variant={user.user_status === "ACTIVE" ? "outline" : "default"}
                    className={cn(
                      "flex-1",
                      user.user_status !== "ACTIVE" &&
                        "bg-(--lagoon-deep) text-white hover:bg-(--lagoon-deep)/90",
                    )}
                    disabled={submitting}
                    onClick={() =>
                      void run(
                        () =>
                          setUserActiveFn({
                            data: {
                              userId: user.id,
                              is_active: user.user_status !== "ACTIVE",
                            },
                          }),
                        user.user_status === "ACTIVE"
                          ? "Account suspended."
                          : "Account restored.",
                      )
                    }
                  >
                    {user.user_status === "ACTIVE"
                      ? "Suspend account"
                      : "Restore access"}
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
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
                {!user.mfa_enabled ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    MFA is not enabled for this account.
                  </p>
                ) : null}
              </DetailSection>

              {user.role === "LECTURER" ? (
                <DetailSection
                  title="Module ownership"
                  description={`Owns ${detail.modules_as_lecturer.length} module(s) · ${detail.active_tutor_assignments} active tutor assignment(s).`}
                  icon={BookOpen}
                >
                  <div className="space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Select value={moduleId} onValueChange={setModuleId}>
                        <SelectTrigger className="w-full bg-background sm:flex-1">
                          <SelectValue placeholder="Select module to assign" />
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
                        className="shrink-0 sm:w-auto"
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
                      <ul className="divide-y rounded-lg border bg-muted/20 text-sm">
                        {detail.modules_as_lecturer.map((m) => (
                          <li
                            key={m.id}
                            className="flex items-center justify-between gap-2 px-3 py-2"
                          >
                            <span className="font-medium">{m.code}</span>
                            <span className="truncate text-muted-foreground">
                              {m.name}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No modules assigned yet.
                      </p>
                    )}
                  </div>
                </DetailSection>
              ) : null}

              {user.role === "TUTOR" ? (
                <DetailSection
                  title="Tutor hour allocations"
                  description="Reserve hours for this tutor across institution modules and academic terms."
                  icon={Calendar}
                >
                  <AdminTutorHourAllocationsPanel
                    tutorId={user.id}
                    modules={modules}
                  />
                </DetailSection>
              ) : null}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
