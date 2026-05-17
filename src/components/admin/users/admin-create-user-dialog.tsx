import { format } from "date-fns";
import { Copy, Loader2, UserPlus } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "#/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "#/components/ui/collapsible";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/components/ui/tabs";
import { toast } from "#/lib/toast";
import { formatRoleLabel, SELF_REGISTER_ROLES } from "#/lib/user-role";
import {
  createRegistrationInviteFn,
  listRegistrationInvitesFn,
  provisionInstitutionUserFn,
  revokeRegistrationInviteFn,
  type RegistrationInviteRowDTO,
} from "#/server-actions/admin-users";

const selectContentProps = {
  position: "popper" as const,
  sideOffset: 4,
  className: "z-[100] max-h-60 w-[var(--radix-select-trigger-width)]",
};

type AdminCreateUserDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
};

type SuccessState =
  | {
      kind: "provision";
      email: string;
      temporaryPassword?: string;
      created: boolean;
    }
  | {
      kind: "invite";
      email: string;
      code: string;
      expiresAt: string;
      role: string;
    };

export function AdminCreateUserDialog({
  open,
  onOpenChange,
  onComplete,
}: AdminCreateUserDialogProps) {
  const [tab, setTab] = useState<"provision" | "invite">("provision");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("TUTOR");
  const [tempPassword, setTempPassword] = useState("");
  const [skipOnboarding, setSkipOnboarding] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState("7");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [pendingInvites, setPendingInvites] = useState<
    RegistrationInviteRowDTO[]
  >([]);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [invitesOpen, setInvitesOpen] = useState(false);

  const resetForm = () => {
    setTab("provision");
    setFullName("");
    setEmail("");
    setRole("TUTOR");
    setTempPassword("");
    setSkipOnboarding(false);
    setExpiresInDays("7");
    setSuccess(null);
  };

  const loadPendingInvites = () => {
    setLoadingInvites(true);
    void listRegistrationInvitesFn()
      .then((res) => setPendingInvites(res.invites))
      .catch(() => setPendingInvites([]))
      .finally(() => setLoadingInvites(false));
  };

  useEffect(() => {
    if (!open) return;
    resetForm();
    loadPendingInvites();
  }, [open]);

  const handleOpenChange = (next: boolean) => {
    if (!next && success) {
      onComplete();
    }
    onOpenChange(next);
    if (!next) resetForm();
  };

  const copyText = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !fullName.trim()) {
      toast.error("Email and full name are required.");
      return;
    }
    setBusy(true);
    try {
      const result = await provisionInstitutionUserFn({
        data: {
          email: email.trim(),
          fullName: fullName.trim(),
          role: role as "TUTOR" | "LECTURER" | "ADMIN",
          temporaryPassword: tempPassword.trim() || undefined,
          skipOnboarding,
        },
      });
      setSuccess({
        kind: "provision",
        email: result.email,
        temporaryPassword: result.temporaryPassword,
        created: result.created,
      });
      onComplete();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not provision user");
    } finally {
      setBusy(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Email is required.");
      return;
    }
    setBusy(true);
    try {
      const days = Number.parseInt(expiresInDays, 10);
      const result = await createRegistrationInviteFn({
        data: {
          email: email.trim(),
          fullName: fullName.trim() || undefined,
          role: role as "TUTOR" | "LECTURER" | "ADMIN",
          expiresInDays: Number.isFinite(days) ? days : 7,
        },
      });
      setSuccess({
        kind: "invite",
        email: result.email,
        code: result.code,
        expiresAt: result.expiresAt,
        role: result.role,
      });
      loadPendingInvites();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create invite");
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async (inviteId: string) => {
    try {
      await revokeRegistrationInviteFn({ data: { inviteId } });
      toast.success("Invite revoked");
      loadPendingInvites();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not revoke invite");
    }
  };

  const canProvision =
    Boolean(email.trim() && fullName.trim()) && !busy && !success;
  const canInvite = Boolean(email.trim()) && !busy && !success;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,40rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b border-border/60 px-6 pt-6 pb-4 text-left">
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-5 text-(--lagoon-deep)" />
            Add user
          </DialogTitle>
          <DialogDescription>
            Create an account immediately or issue a one-time invite code for
            self-registration.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
          {success ? (
            <SuccessPanel success={success} onCopy={copyText} />
          ) : (
            <>
              <Tabs
                value={tab}
                onValueChange={(v) => setTab(v as "provision" | "invite")}
              >
                <TabsList className="mb-4 grid w-full grid-cols-2">
                  <TabsTrigger value="provision">Provision now</TabsTrigger>
                  <TabsTrigger value="invite">Invite to register</TabsTrigger>
                </TabsList>

                <Field label="Role">
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent {...selectContentProps}>
                      {SELF_REGISTER_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {formatRoleLabel(r)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <TabsContent value="provision" className="mt-4 space-y-4">
                  <form
                    id="provision-user-form"
                    className="grid gap-4"
                    onSubmit={(e) => void handleProvision(e)}
                  >
                    <Field label="Full name">
                      <Input
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Jane Smith"
                        autoComplete="name"
                      />
                    </Field>
                    <Field label="Email">
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@university.ac.za"
                        autoComplete="email"
                      />
                    </Field>
                    <Field label="Temporary password (optional)">
                      <Input
                        type="password"
                        value={tempPassword}
                        onChange={(e) => setTempPassword(e.target.value)}
                        placeholder="Min. 8 characters — auto-generated if empty"
                        autoComplete="new-password"
                      />
                    </Field>
                    <label className="flex cursor-pointer items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={skipOnboarding}
                        onChange={(e) => setSkipOnboarding(e.target.checked)}
                      />
                      <span>
                        Skip onboarding approval (mark account as approved
                        immediately)
                      </span>
                    </label>
                  </form>
                </TabsContent>

                <TabsContent value="invite" className="mt-4 space-y-4">
                  <form
                    id="invite-user-form"
                    className="grid gap-4"
                    onSubmit={(e) => void handleInvite(e)}
                  >
                    <Field label="Full name (optional)">
                      <Input
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Pre-fills the registration form"
                        autoComplete="name"
                      />
                    </Field>
                    <Field label="Email">
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Must match when they register"
                        autoComplete="email"
                      />
                    </Field>
                    <Field label="Invite expires in (days)">
                      <Select
                        value={expiresInDays}
                        onValueChange={setExpiresInDays}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent {...selectContentProps}>
                          <SelectItem value="3">3 days</SelectItem>
                          <SelectItem value="7">7 days</SelectItem>
                          <SelectItem value="14">14 days</SelectItem>
                          <SelectItem value="30">30 days</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <p className="text-xs text-muted-foreground">
                      Share the invite code once. They complete registration at{" "}
                      <Link to="/auth/register" className="underline">
                        /auth/register
                      </Link>
                      .
                    </p>
                  </form>
                </TabsContent>
              </Tabs>

              <Collapsible
                open={invitesOpen}
                onOpenChange={setInvitesOpen}
                className="mt-6 border-t border-border/60 pt-4"
              >
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full justify-between px-0"
                  >
                    Pending invites
                    <span className="text-muted-foreground">
                      {loadingInvites ? "…" : pendingInvites.length}
                    </span>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-2">
                  {loadingInvites ? (
                    <p className="text-sm text-muted-foreground">Loading…</p>
                  ) : pendingInvites.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No active invites.
                    </p>
                  ) : (
                    pendingInvites.map((inv) => (
                      <div
                        key={inv.id}
                        className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">{inv.email}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatRoleLabel(inv.role)} · expires{" "}
                            {format(new Date(inv.expires_at), "d MMM yyyy")}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void handleRevoke(inv.id)}
                        >
                          Revoke
                        </Button>
                      </div>
                    ))
                  )}
                </CollapsibleContent>
              </Collapsible>
            </>
          )}
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-border/60 bg-muted/10 px-6 py-4 sm:justify-end">
          {success ? (
            <Button type="button" onClick={() => handleOpenChange(false)}>
              Done
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={busy}
              >
                Cancel
              </Button>
              {tab === "provision" ? (
                <Button
                  type="submit"
                  form="provision-user-form"
                  disabled={!canProvision}
                >
                  {busy ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Creating…
                    </>
                  ) : (
                    "Create account"
                  )}
                </Button>
              ) : (
                <Button
                  type="submit"
                  form="invite-user-form"
                  disabled={!canInvite}
                >
                  {busy ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Creating invite…
                    </>
                  ) : (
                    "Create invite"
                  )}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SuccessPanel({
  success,
  onCopy,
}: {
  success: SuccessState;
  onCopy: (label: string, value: string) => void;
}) {
  if (success.kind === "provision") {
    return (
      <div className="space-y-4 rounded-lg border border-emerald-300/60 bg-emerald-50/80 px-4 py-4 text-sm text-emerald-950">
        <p className="font-medium">
          {success.created
            ? "Account created"
            : "Existing account updated for your institution"}
        </p>
        <CredentialRow
          label="Email"
          value={success.email}
          onCopy={() => void onCopy("Email", success.email)}
        />
        {success.temporaryPassword ? (
          <CredentialRow
            label="Temporary password"
            value={success.temporaryPassword}
            onCopy={() =>
              void onCopy("Password", success.temporaryPassword!)
            }
          />
        ) : null}
        <p className="text-xs">
          Share these credentials securely. The user can sign in at{" "}
          <Link to="/auth/login" className="underline">
            /auth/login
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-sky-300/60 bg-sky-50/80 px-4 py-4 text-sm text-sky-950">
      <p className="font-medium">Invite created</p>
      <p className="text-xs">
        Joining as {formatRoleLabel(success.role)}. Expires{" "}
        {format(new Date(success.expiresAt), "d MMM yyyy HH:mm")}.
      </p>
      <CredentialRow
        label="Email"
        value={success.email}
        onCopy={() => void onCopy("Email", success.email)}
      />
      <CredentialRow
        label="Invite code"
        value={success.code}
        onCopy={() => void onCopy("Invite code", success.code)}
      />
      <p className="text-xs">
        They register at{" "}
        <Link to="/auth/register" className="underline">
          /auth/register
        </Link>{" "}
        using this email and code.
      </p>
    </div>
  );
}

function CredentialRow({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-white/60 px-3 py-2 font-mono text-xs">
      <div className="min-w-0">
        <span className="block text-[10px] font-sans uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="break-all">{value}</span>
      </div>
      <Button type="button" variant="ghost" size="icon" onClick={onCopy}>
        <Copy className="size-4" />
        <span className="sr-only">Copy {label}</span>
      </Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}
