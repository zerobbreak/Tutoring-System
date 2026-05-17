import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
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
import { Switch } from "#/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table";
import { toast } from "#/lib/toast";
import {
  createModuleFn,
  updateModuleFn,
  type AcademicTermDTO,
  type InstitutionLecturerOptionDTO,
  type InstitutionModuleDTO,
} from "#/server-actions/admin-institutions";

const selectContentProps = {
  className: "z-[200]",
  position: "popper" as const,
};

const NONE_TERM = "__none__";

type ModulesPanelProps = {
  modules: InstitutionModuleDTO[];
  lecturers: InstitutionLecturerOptionDTO[];
  academicTerms: AcademicTermDTO[];
  booting: boolean;
  onUpdated: () => void;
};

type ModuleFormState = {
  code: string;
  name: string;
  lecturer_id: string;
  academic_term_id: string;
  is_active: boolean;
  tutor_hourly_rate: string;
};

const emptyForm = (): ModuleFormState => ({
  code: "",
  name: "",
  lecturer_id: "",
  academic_term_id: NONE_TERM,
  is_active: true,
  tutor_hourly_rate: "",
});

export function ModulesPanel({
  modules,
  lecturers,
  academicTerms,
  booting,
  onUpdated,
}: ModulesPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<InstitutionModuleDTO | null>(null);
  const [form, setForm] = useState<ModuleFormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyForm(),
      lecturer_id: lecturers[0]?.id ?? "",
    });
    setDialogOpen(true);
  };

  const openEdit = (mod: InstitutionModuleDTO) => {
    setEditing(mod);
    setForm({
      code: mod.code,
      name: mod.name,
      lecturer_id: mod.lecturer_id,
      academic_term_id: mod.academic_term_id ?? NONE_TERM,
      is_active: mod.is_active,
      tutor_hourly_rate: mod.tutor_hourly_rate_cents
        ? String(mod.tutor_hourly_rate_cents / 100)
        : "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.code.trim()) {
      toast.error("Module code is required.");
      return;
    }
    if (!form.name.trim()) {
      toast.error("Module name is required.");
      return;
    }
    if (!form.lecturer_id) {
      toast.error("Select a lecturer for this module.");
      return;
    }

    const academicTermId =
      form.academic_term_id === NONE_TERM ? null : form.academic_term_id;

    setSaving(true);
    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        lecturer_id: form.lecturer_id,
        academic_term_id: academicTermId,
        is_active: form.is_active,
        tutor_hourly_rate: form.tutor_hourly_rate.trim() || null,
      };
      if (editing) {
        await updateModuleFn({ data: { id: editing.id, ...payload } });
        toast.success("Module updated.");
      } else {
        await createModuleFn({ data: payload });
        toast.success("Module created.");
      }
      setDialogOpen(false);
      onUpdated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save module");
    } finally {
      setSaving(false);
    }
  };

  const canAdd = lecturers.length > 0;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Modules</CardTitle>
            <CardDescription>
              Courses and subjects — required before assigning tutors or
              scheduling sessions
            </CardDescription>
          </div>
          <Button
            size="sm"
            onClick={openCreate}
            disabled={booting || !canAdd}
            title={
              canAdd
                ? undefined
                : "Add at least one active lecturer before creating modules"
            }
          >
            <Plus className="size-4" />
            Add module
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {!canAdd && !booting ? (
            <p className="text-sm text-amber-800 dark:text-amber-200">
              No active lecturers in your institution. Onboard a lecturer under
              Users before adding modules.
            </p>
          ) : null}
          {booting ? (
            <p className="text-sm text-muted-foreground">Loading modules…</p>
          ) : modules.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No modules yet. Add one and assign a lecturer to unlock schedules
              and tutor assignments.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Lecturer</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {modules.map((mod) => (
                  <TableRow key={mod.id}>
                    <TableCell className="font-medium">{mod.code}</TableCell>
                    <TableCell>{mod.name}</TableCell>
                    <TableCell className="max-w-[160px] truncate">
                      {mod.lecturer_name ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-[140px] truncate text-muted-foreground">
                      {mod.academic_term_label ?? "—"}
                    </TableCell>
                    <TableCell>
                      {mod.is_active ? (
                        <Badge variant="secondary">Active</Badge>
                      ) : (
                        <Badge variant="outline">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit ${mod.code}`}
                        onClick={() => openEdit(mod)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit module" : "Add module"}</DialogTitle>
            <DialogDescription>
              Each module must have an owning lecturer. Tutors are assigned to
              modules separately on Schedules or by the lecturer.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label htmlFor="module-code">Code</Label>
              <Input
                id="module-code"
                value={form.code}
                onChange={(e) =>
                  setForm((f) => ({ ...f, code: e.target.value }))
                }
                placeholder="e.g. CS101"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="module-name">Name</Label>
              <Input
                id="module-name"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="e.g. Introduction to Programming"
              />
            </div>
            <div className="grid gap-2">
              <Label>Lecturer</Label>
              <Select
                value={form.lecturer_id}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, lecturer_id: v }))
                }
              >
                <SelectTrigger className="w-full bg-background">
                  <SelectValue placeholder="Select lecturer" />
                </SelectTrigger>
                <SelectContent {...selectContentProps}>
                  {lecturers.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.full_name}
                      {l.email ? ` · ${l.email}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Academic term (optional)</Label>
              <Select
                value={form.academic_term_id}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, academic_term_id: v }))
                }
              >
                <SelectTrigger className="w-full bg-background">
                  <SelectValue placeholder="No term linked" />
                </SelectTrigger>
                <SelectContent {...selectContentProps}>
                  <SelectItem value={NONE_TERM}>No term linked</SelectItem>
                  {academicTerms.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label} ({t.academic_year})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="module-rate">Hourly rate override (optional)</Label>
              <Input
                id="module-rate"
                value={form.tutor_hourly_rate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tutor_hourly_rate: e.target.value }))
                }
                placeholder="Institution default (225)"
              />
              <p className="text-xs text-muted-foreground">
                ZAR per hour for tutor earnings on this module. Leave blank to
                use the institution default.
              </p>
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="module-active">Active</Label>
              <Switch
                id="module-active"
                checked={form.is_active}
                onCheckedChange={(checked) =>
                  setForm((f) => ({ ...f, is_active: checked }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button disabled={saving} onClick={() => void handleSubmit()}>
              {saving ? "Saving…" : editing ? "Save changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
