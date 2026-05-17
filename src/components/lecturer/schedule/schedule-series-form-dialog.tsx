import { useEffect, useMemo, useState } from "react";
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
import type {
  ScheduleModuleOptionDTO,
  ScheduleTutorOptionDTO,
  VenueDTO,
} from "#/server-actions/lecturer-schedule";
import { toast } from "#/lib/toast";

const WEEKDAYS: { value: number; label: string }[] = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

/** Keeps dropdown menus above the dialog overlay (z-50). */
const selectContentProps = {
  position: "popper" as const,
  sideOffset: 4,
  className: "z-[100] max-h-60",
};

const selectTriggerClass = "w-full";

export type SeriesFormValues = {
  moduleId: string;
  title: string;
  tutorId: string;
  venueId: string | null;
  venueText: string;
  dtstartLocal: string;
  durationMinutes: number;
  byWeekday: number[];
  until: string;
};

type ScheduleSeriesFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modules: ScheduleModuleOptionDTO[];
  tutors: ScheduleTutorOptionDTO[];
  tutorIdsByModule: Record<string, string[]>;
  venues: VenueDTO[];
  busy: boolean;
  onSubmit: (values: SeriesFormValues) => Promise<void>;
};

function defaultDtstartLocal(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(14);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function initialFormState(modules: ScheduleModuleOptionDTO[]) {
  const moduleId = modules[0]?.id ?? "";
  const mod = modules[0];
  return {
    moduleId,
    title: mod ? `${mod.code} Tutorial` : "",
    tutorId: "",
    venueId: "",
    venueText: "",
    dtstartLocal: defaultDtstartLocal(),
    durationMinutes: 120,
    byWeekday: [1] as number[],
    until: "",
  };
}

export function ScheduleSeriesFormDialog({
  open,
  onOpenChange,
  modules,
  tutors,
  tutorIdsByModule,
  venues,
  busy,
  onSubmit,
}: ScheduleSeriesFormDialogProps) {
  const [form, setForm] = useState(() => initialFormState(modules));

  useEffect(() => {
    if (open) setForm(initialFormState(modules));
  }, [open, modules]);

  const tutorsForModule = useMemo(() => {
    const ids = new Set(tutorIdsByModule[form.moduleId] ?? []);
    return tutors.filter((t) => ids.has(t.id));
  }, [form.moduleId, tutorIdsByModule, tutors]);

  const selectableTutors =
    tutorsForModule.length > 0 ? tutorsForModule : tutors;

  useEffect(() => {
    if (!form.moduleId) return;
    const mod = modules.find((m) => m.id === form.moduleId);
    if (mod) {
      setForm((f) => ({
        ...f,
        title: f.title || `${mod.code} Tutorial`,
        tutorId:
          f.tutorId && selectableTutors.some((t) => t.id === f.tutorId)
            ? f.tutorId
            : (selectableTutors[0]?.id ?? ""),
      }));
    }
  }, [form.moduleId, modules, selectableTutors]);

  const toggleWeekday = (day: number) => {
    setForm((f) => ({
      ...f,
      byWeekday: f.byWeekday.includes(day)
        ? f.byWeekday.filter((d) => d !== day)
        : [...f.byWeekday, day].sort(),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.moduleId || !form.title.trim()) {
      toast.error("Module and title are required.");
      return;
    }
    if (!form.tutorId) {
      toast.error(
        tutors.length
          ? "Select a tutor for this series."
          : "No tutors in your institution. Add a tutor before creating a schedule.",
      );
      return;
    }
    if (!form.byWeekday.length) {
      toast.error("Select at least one weekday.");
      return;
    }
    const dtstart = new Date(form.dtstartLocal);
    if (Number.isNaN(dtstart.getTime())) {
      toast.error("Invalid start date/time.");
      return;
    }
    await onSubmit({
      moduleId: form.moduleId,
      title: form.title.trim(),
      tutorId: form.tutorId,
      venueId: form.venueId || null,
      venueText: form.venueText,
      dtstartLocal: form.dtstartLocal,
      durationMinutes: form.durationMinutes,
      byWeekday: form.byWeekday,
      until: form.until,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,40rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={(e) => void handleSubmit(e)}>
          <DialogHeader className="shrink-0 border-b border-border/60 px-6 pt-6 pb-4">
            <DialogTitle>Create tutorial schedule</DialogTitle>
            <DialogDescription>
              Define a recurring tutorial series. Publish to generate sessions and
              notify the assigned tutor.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
            <div className="grid gap-4">
              <Field label="Module">
                {modules.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No modules are linked to your account yet.
                  </p>
                ) : (
                  <Select
                    value={form.moduleId}
                    onValueChange={(moduleId) =>
                      setForm((f) => ({ ...f, moduleId, tutorId: "" }))
                    }
                  >
                    <SelectTrigger className={selectTriggerClass}>
                      <SelectValue placeholder="Select module" />
                    </SelectTrigger>
                    <SelectContent {...selectContentProps}>
                      {modules.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.code} — {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>

              <Field label="Title" htmlFor="series-title">
                <Input
                  id="series-title"
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  placeholder="INF214 Tutorial"
                />
              </Field>

              <Field label="Tutor">
                {!selectableTutors.length ? (
                  <p className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
                    No tutors in your institution yet. Add a tutor from the Users
                    or Tutors page before creating a schedule.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {!tutorsForModule.length ? (
                      <p className="text-sm text-muted-foreground">
                        No tutor is linked to this module yet. Pick one below —
                        they will be assigned when you save.
                      </p>
                    ) : null}
                    <Select
                      value={form.tutorId}
                      onValueChange={(tutorId) =>
                        setForm((f) => ({ ...f, tutorId }))
                      }
                    >
                      <SelectTrigger className={selectTriggerClass}>
                        <SelectValue placeholder="Select tutor" />
                      </SelectTrigger>
                      <SelectContent {...selectContentProps}>
                        {selectableTutors.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </Field>

              <Field label="Venue">
                <Select
                  value={form.venueId || "__none__"}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      venueId: v === "__none__" ? "" : v,
                    }))
                  }
                >
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue placeholder="Optional venue" />
                  </SelectTrigger>
                  <SelectContent {...selectContentProps}>
                    <SelectItem value="__none__">No venue record</SelectItem>
                    {venues.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                        {v.code ? ` (${v.code})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="mt-2"
                  value={form.venueText}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, venueText: e.target.value }))
                  }
                  placeholder="Or type venue (e.g. Lab B204)"
                />
              </Field>

              <Field label="First session start" htmlFor="dtstart">
                <Input
                  id="dtstart"
                  type="datetime-local"
                  value={form.dtstartLocal}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, dtstartLocal: e.target.value }))
                  }
                />
              </Field>

              <Field label="Duration (minutes)" htmlFor="duration">
                <Input
                  id="duration"
                  type="number"
                  min={15}
                  max={480}
                  value={form.durationMinutes}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      durationMinutes: Number(e.target.value),
                    }))
                  }
                />
              </Field>

              <Field label="Repeats on">
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS.map((d) => (
                    <Button
                      key={d.value}
                      type="button"
                      size="sm"
                      variant={
                        form.byWeekday.includes(d.value) ? "default" : "outline"
                      }
                      onClick={() => toggleWeekday(d.value)}
                    >
                      {d.label}
                    </Button>
                  ))}
                </div>
              </Field>

              <Field label="Repeat until (optional)" htmlFor="until">
                <Input
                  id="until"
                  type="date"
                  value={form.until}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, until: e.target.value }))
                  }
                />
              </Field>
            </div>
          </div>

          <DialogFooter className="shrink-0 gap-3 border-t border-border/60 px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !modules.length}>
              {busy ? "Saving…" : "Create draft"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
