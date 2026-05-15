import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/components/ui/tabs";
import { toast } from "#/lib/toast";
import {
  assignTutorToModuleFn,
  inviteTutorToModuleFn,
  listAssignableTutorsFn,
  type AssignableTutorDTO,
} from "#/server-actions/lecturer-tutors";

const selectContentProps = {
  position: "popper" as const,
  sideOffset: 4,
  className: "z-[100] max-h-60 w-[var(--radix-select-trigger-width)]",
};

const selectTriggerClass = "w-full";

type AssignTutorDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modules: { id: string; code: string; name: string }[];
  onAssigned: () => void;
};

export function AssignTutorDialog({
  open,
  onOpenChange,
  modules,
  onAssigned,
}: AssignTutorDialogProps) {
  const [tab, setTab] = useState<"existing" | "new">("new");
  const [tutors, setTutors] = useState<AssignableTutorDTO[]>([]);
  const [loadingTutors, setLoadingTutors] = useState(false);
  const [institutionError, setInstitutionError] = useState<string | null>(null);
  const [moduleId, setModuleId] = useState("");
  const [tutorId, setTutorId] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTab("new");
    setModuleId(modules[0]?.id ?? "");
    setTutorId("");
    setEmail("");
    setFullName("");
    setTempPassword("");
    setInstitutionError(null);
    setLoadingTutors(true);
    void listAssignableTutorsFn()
      .then((list) => {
        setTutors(list);
        if (list.length > 0) setTab("existing");
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : "Failed to load tutors";
        setInstitutionError(msg);
        setTutors([]);
      })
      .finally(() => setLoadingTutors(false));
  }, [open, modules]);

  const handleAssignExisting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moduleId || !tutorId) {
      toast.error("Select a module and tutor.");
      return;
    }
    setBusy(true);
    try {
      await assignTutorToModuleFn({
        data: {
          moduleId,
          tutorId,
          startDate: format(new Date(), "yyyy-MM-dd"),
        },
      });
      toast.success("Tutor assigned to module.");
      onAssigned();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not assign tutor");
    } finally {
      setBusy(false);
    }
  };

  const handleInviteNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moduleId || !email.trim() || !fullName.trim()) {
      toast.error("Module, email, and full name are required.");
      return;
    }
    setBusy(true);
    try {
      const result = await inviteTutorToModuleFn({
        data: {
          moduleId,
          email: email.trim(),
          fullName: fullName.trim(),
          temporaryPassword: tempPassword.trim() || undefined,
        },
      });
      toast.success(
        result.created
          ? "Tutor account created and assigned. Share the login email (and temporary password if you set one)."
          : "Existing tutor linked to your institution and assigned.",
      );
      onAssigned();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add tutor");
    } finally {
      setBusy(false);
    }
  };

  const canAssignExisting =
    Boolean(moduleId && tutorId) && !busy && modules.length > 0;

  const canInviteNew =
    Boolean(moduleId && email.trim() && fullName.trim()) &&
    !busy &&
    modules.length > 0 &&
    !institutionError;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,36rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b border-border/60 px-6 pt-6 pb-4 text-left">
          <DialogTitle>Add tutor to module</DialogTitle>
          <DialogDescription>
            Create a new tutor account in your institution or assign someone who
            already has a tutor profile.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
          {institutionError ? (
            <div className="mb-4 rounded-lg border border-amber-300/80 bg-amber-50/90 px-3 py-3 text-sm text-amber-950">
              <p>{institutionError}</p>
              <Link
                to="/lecturer/settings"
                className="mt-2 inline-block font-medium underline"
                onClick={() => onOpenChange(false)}
              >
                Open Settings
              </Link>
            </div>
          ) : null}

          <Tabs value={tab} onValueChange={(v) => setTab(v as "existing" | "new")}>
            <TabsList className="mb-4 grid w-full grid-cols-2">
              <TabsTrigger value="new">New tutor</TabsTrigger>
              <TabsTrigger value="existing">Existing</TabsTrigger>
            </TabsList>

            <Field label="Module">
              {modules.length === 0 ? (
                <p className="rounded-md border border-dashed border-border/80 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                  No modules are linked to your account yet.
                </p>
              ) : (
                <Select value={moduleId} onValueChange={setModuleId}>
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue placeholder="Select module" />
                  </SelectTrigger>
                  <SelectContent {...selectContentProps}>
                    {modules.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        <span className="font-medium">{m.code}</span>
                        <span className="text-muted-foreground"> — {m.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>

            <TabsContent value="new" className="mt-0 space-y-4">
              <form
                id="invite-tutor-form"
                className="grid gap-4"
                onSubmit={(e) => void handleInviteNew(e)}
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
                    placeholder="tutor@university.ac.za"
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
                  <p className="text-xs text-muted-foreground">
                    Creates an auth account and a row in the users table. The
                    tutor can sign in with this email and password.
                  </p>
                </Field>
              </form>
            </TabsContent>

            <TabsContent value="existing" className="mt-0 space-y-4">
              <form
                id="assign-tutor-form"
                className="grid gap-4"
                onSubmit={(e) => void handleAssignExisting(e)}
              >
                <Field label="Tutor">
                  {loadingTutors ? (
                    <div className="flex h-10 items-center gap-2 rounded-md border border-input bg-muted/30 px-3 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      Loading tutors…
                    </div>
                  ) : tutors.length === 0 ? (
                    <p className="rounded-md border border-dashed border-border/80 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                      No tutors in your institution yet. Use the{" "}
                      <strong>New tutor</strong> tab to create one.
                    </p>
                  ) : (
                    <Select value={tutorId} onValueChange={setTutorId}>
                      <SelectTrigger className={selectTriggerClass}>
                        <SelectValue placeholder="Select tutor" />
                      </SelectTrigger>
                      <SelectContent {...selectContentProps}>
                        {tutors.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.fullName} · {t.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </Field>
              </form>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-border/60 bg-muted/10 px-6 py-4 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          {tab === "new" ? (
            <Button
              type="submit"
              form="invite-tutor-form"
              disabled={!canInviteNew}
            >
              {busy ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Creating…
                </>
              ) : (
                "Create & assign"
              )}
            </Button>
          ) : (
            <Button
              type="submit"
              form="assign-tutor-form"
              disabled={!canAssignExisting}
            >
              {busy ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Assigning…
                </>
              ) : (
                "Assign tutor"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
