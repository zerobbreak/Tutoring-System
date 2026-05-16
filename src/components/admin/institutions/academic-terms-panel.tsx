import { useState } from "react";
import { Pencil, Plus, Star } from "lucide-react";
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
  createAcademicTermFn,
  deleteAcademicTermFn,
  setCurrentAcademicTermFn,
  updateAcademicTermFn,
  type AcademicTermDTO,
} from "#/server-actions/admin-institutions";

type AcademicTermsPanelProps = {
  terms: AcademicTermDTO[];
  booting: boolean;
  onUpdated: () => void;
};

type TermFormState = {
  label: string;
  academic_year: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
};

const emptyForm = (): TermFormState => ({
  label: "",
  academic_year: new Date().getFullYear().toString(),
  start_date: "",
  end_date: "",
  is_current: false,
});

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function AcademicTermsPanel({
  terms,
  booting,
  onUpdated,
}: AcademicTermsPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AcademicTermDTO | null>(null);
  const [form, setForm] = useState<TermFormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (term: AcademicTermDTO) => {
    setEditing(term);
    setForm({
      label: term.label,
      academic_year: term.academic_year,
      start_date: term.start_date,
      end_date: term.end_date,
      is_current: term.is_current,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.label.trim() || !form.academic_year.trim()) {
      toast.error("Label and academic year are required.");
      return;
    }
    if (!form.start_date || !form.end_date) {
      toast.error("Start and end dates are required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        label: form.label.trim(),
        academic_year: form.academic_year.trim(),
        start_date: form.start_date,
        end_date: form.end_date,
        is_current: form.is_current,
      };
      if (editing) {
        await updateAcademicTermFn({ data: { id: editing.id, ...payload } });
        toast.success("Academic term updated.");
      } else {
        await createAcademicTermFn({ data: payload });
        toast.success("Academic term created.");
      }
      setDialogOpen(false);
      onUpdated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save term");
    } finally {
      setSaving(false);
    }
  };

  const handleSetCurrent = async (term: AcademicTermDTO) => {
    if (term.is_current) return;
    try {
      await setCurrentAcademicTermFn({ data: { id: term.id } });
      toast.success(`"${term.label}" is now the current term.`);
      onUpdated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to set current term");
    }
  };

  const handleDelete = async (term: AcademicTermDTO) => {
    if (
      !window.confirm(
        `Delete "${term.label}" (${term.academic_year})? This cannot be undone.`,
      )
    ) {
      return;
    }
    try {
      await deleteAcademicTermFn({ data: { id: term.id } });
      toast.success("Academic term deleted.");
      onUpdated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete term");
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Academic terms</CardTitle>
            <CardDescription>
              Semesters and terms for institution configuration
            </CardDescription>
          </div>
          <Button size="sm" onClick={openCreate} disabled={booting}>
            <Plus className="size-4" />
            Add term
          </Button>
        </CardHeader>
        <CardContent>
          {booting ? (
            <p className="text-sm text-muted-foreground">Loading terms…</p>
          ) : terms.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No academic terms yet. Add terms to track your academic calendar.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Current</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {terms.map((term) => (
                  <TableRow key={term.id}>
                    <TableCell className="font-medium">{term.label}</TableCell>
                    <TableCell>{term.academic_year}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(term.start_date)} —{" "}
                      {formatDate(term.end_date)}
                    </TableCell>
                    <TableCell>
                      {term.is_current ? (
                        <Badge>Current</Badge>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 px-2"
                          onClick={() => void handleSetCurrent(term)}
                        >
                          <Star className="size-3.5" />
                          Set current
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${term.label}`}
                          onClick={() => openEdit(term)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => void handleDelete(term)}
                        >
                          Delete
                        </Button>
                      </div>
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
            <DialogTitle>
              {editing ? "Edit academic term" : "Add academic term"}
            </DialogTitle>
            <DialogDescription>
              Only one term can be marked current per institution.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label htmlFor="term-label">Label</Label>
              <Input
                id="term-label"
                placeholder="Semester 1"
                value={form.label}
                onChange={(e) =>
                  setForm((f) => ({ ...f, label: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="term-year">Academic year</Label>
              <Input
                id="term-year"
                placeholder="2026"
                value={form.academic_year}
                onChange={(e) =>
                  setForm((f) => ({ ...f, academic_year: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="term-start">Start date</Label>
                <Input
                  id="term-start"
                  type="date"
                  value={form.start_date}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, start_date: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="term-end">End date</Label>
                <Input
                  id="term-end"
                  type="date"
                  value={form.end_date}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, end_date: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="term-current">Set as current term</Label>
              <Switch
                id="term-current"
                checked={form.is_current}
                onCheckedChange={(checked) =>
                  setForm((f) => ({ ...f, is_current: checked }))
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
