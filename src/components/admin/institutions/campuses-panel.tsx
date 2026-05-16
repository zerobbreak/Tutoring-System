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
  createCampusFn,
  updateCampusFn,
  type CampusDTO,
} from "#/server-actions/admin-institutions";

type CampusesPanelProps = {
  campuses: CampusDTO[];
  booting: boolean;
  onUpdated: () => void;
};

type CampusFormState = {
  name: string;
  code: string;
  address: string;
  is_active: boolean;
};

const emptyForm = (): CampusFormState => ({
  name: "",
  code: "",
  address: "",
  is_active: true,
});

export function CampusesPanel({
  campuses,
  booting,
  onUpdated,
}: CampusesPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CampusDTO | null>(null);
  const [form, setForm] = useState<CampusFormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (campus: CampusDTO) => {
    setEditing(campus);
    setForm({
      name: campus.name,
      code: campus.code ?? "",
      address: campus.address ?? "",
      is_active: campus.is_active,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error("Campus name is required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim() || null,
        address: form.address.trim() || null,
        is_active: form.is_active,
      };
      if (editing) {
        await updateCampusFn({ data: { id: editing.id, ...payload } });
        toast.success("Campus updated.");
      } else {
        await createCampusFn({ data: payload });
        toast.success("Campus created.");
      }
      setDialogOpen(false);
      onUpdated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save campus");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Campuses</CardTitle>
            <CardDescription>
              Physical locations for your institution
            </CardDescription>
          </div>
          <Button size="sm" onClick={openCreate} disabled={booting}>
            <Plus className="size-4" />
            Add campus
          </Button>
        </CardHeader>
        <CardContent>
          {booting ? (
            <p className="text-sm text-muted-foreground">Loading campuses…</p>
          ) : campuses.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No campuses yet. Add one to link venues by location.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {campuses.map((campus) => (
                  <TableRow key={campus.id}>
                    <TableCell className="font-medium">{campus.name}</TableCell>
                    <TableCell>{campus.code ?? "—"}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {campus.address ?? "—"}
                    </TableCell>
                    <TableCell>
                      {campus.is_active ? (
                        <Badge variant="secondary">Active</Badge>
                      ) : (
                        <Badge variant="outline">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit ${campus.name}`}
                        onClick={() => openEdit(campus)}
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
            <DialogTitle>{editing ? "Edit campus" : "Add campus"}</DialogTitle>
            <DialogDescription>
              Campuses can be linked to venues on the schedules page.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label htmlFor="campus-name">Name</Label>
              <Input
                id="campus-name"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="campus-code">Code (optional)</Label>
              <Input
                id="campus-code"
                value={form.code}
                onChange={(e) =>
                  setForm((f) => ({ ...f, code: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="campus-address">Address (optional)</Label>
              <Input
                id="campus-address"
                value={form.address}
                onChange={(e) =>
                  setForm((f) => ({ ...f, address: e.target.value }))
                }
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="campus-active">Active</Label>
              <Switch
                id="campus-active"
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
