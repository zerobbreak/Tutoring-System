import { useState } from "react";
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
import { Switch } from "#/components/ui/switch";
import { toast } from "#/lib/toast";
import {
  createVenueFn,
  updateVenueFn,
  type AdminVenueDTO,
} from "#/server-actions/admin-venues";
import type { CampusDTO } from "#/server-actions/admin-institutions";
import {
  VENUE_ACCESS_CONTROLS,
  venueAccessControlLabel,
  type VenueAccessControl,
} from "#/lib/venue-access";

type VenueDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: AdminVenueDTO | null;
  campuses: CampusDTO[];
  onSaved: () => void;
};

type VenueFormState = {
  name: string;
  code: string;
  capacity: string;
  campusId: string;
  accessControl: VenueAccessControl;
  is_active: boolean;
};

const emptyForm = (): VenueFormState => ({
  name: "",
  code: "",
  capacity: "",
  campusId: "",
  accessControl: "OPEN",
  is_active: true,
});

export function formFromVenue(venue: AdminVenueDTO): VenueFormState {
  return {
    name: venue.name,
    code: venue.code ?? "",
    capacity: venue.capacity != null ? String(venue.capacity) : "",
    campusId: venue.campusId ?? "",
    accessControl: venue.accessControl,
    is_active: venue.isActive,
  };
}

export function VenueDialog({
  open,
  onOpenChange,
  editing,
  campuses,
  onSaved,
}: VenueDialogProps) {
  const [form, setForm] = useState<VenueFormState>(
    editing ? formFromVenue(editing) : emptyForm(),
  );
  const [saving, setSaving] = useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen && !open) {
      setForm(editing ? formFromVenue(editing) : emptyForm());
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error("Venue name is required.");
      return;
    }
    setSaving(true);
    try {
      const capacity = form.capacity.trim()
        ? parseInt(form.capacity.trim(), 10)
        : null;
      if (capacity !== null && (isNaN(capacity) || capacity <= 0)) {
        toast.error("Capacity must be a positive number.");
        setSaving(false);
        return;
      }

      const payload = {
        name: form.name.trim(),
        code: form.code.trim() || null,
        capacity,
        campusId: form.campusId || null,
        accessControl: form.accessControl,
        isActive: form.is_active,
      };

      if (editing) {
        await updateVenueFn({ data: { id: editing.id, ...payload } });
        toast.success("Venue updated.");
      } else {
        await createVenueFn({ data: payload });
        toast.success("Venue created.");
      }
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save venue");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit venue" : "Add venue"}</DialogTitle>
          <DialogDescription>
            Venues can be assigned to schedules for session locations.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-2">
            <Label htmlFor="venue-name">Name</Label>
            <Input
              id="venue-name"
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value }))
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="venue-code">Code (optional)</Label>
            <Input
              id="venue-code"
              value={form.code}
              onChange={(e) =>
                setForm((f) => ({ ...f, code: e.target.value }))
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="venue-capacity">Capacity (optional)</Label>
            <Input
              id="venue-capacity"
              type="number"
              min={1}
              value={form.capacity}
              onChange={(e) =>
                setForm((f) => ({ ...f, capacity: e.target.value }))
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="venue-campus">Campus (optional)</Label>
            <Select
              value={form.campusId}
              onValueChange={(value) =>
                setForm((f) => ({ ...f, campusId: value === "__none__" ? "" : value }))
              }
            >
              <SelectTrigger id="venue-campus">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {campuses
                  .filter((c) => c.is_active)
                  .map((campus) => (
                    <SelectItem key={campus.id} value={campus.id}>
                      {campus.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="venue-access">Access control</Label>
            <Select
              value={form.accessControl}
              onValueChange={(value) =>
                setForm((f) => ({
                  ...f,
                  accessControl: value as VenueAccessControl,
                }))
              }
            >
              <SelectTrigger id="venue-access">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VENUE_ACCESS_CONTROLS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {venueAccessControlLabel(value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="venue-active">Active</Label>
            <Switch
              id="venue-active"
              checked={form.is_active}
              onCheckedChange={(checked) =>
                setForm((f) => ({ ...f, is_active: checked }))
              }
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={saving} onClick={() => void handleSubmit()}>
            {saving ? "Saving…" : editing ? "Save changes" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
