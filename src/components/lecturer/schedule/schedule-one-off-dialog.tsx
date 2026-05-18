import { useEffect, useState, type ReactNode } from "react";
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

export type OneOffFormValues = {
  moduleId: string;
  title: string;
  tutorId: string;
  venueId: string | null;
  venueText: string;
  dtstartLocal: string;
  durationMinutes: number;
  sessionKind: string;
};

type ScheduleOneOffDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modules: ScheduleModuleOptionDTO[];
  tutors: ScheduleTutorOptionDTO[];
  tutorIdsByModule: Record<string, string[]>;
  venues: VenueDTO[];
  busy: boolean;
  onSubmit: (values: OneOffFormValues) => Promise<void>;
};

function defaultDtstartLocal(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(14);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function ScheduleOneOffDialog({
  open,
  onOpenChange,
  modules,
  tutors,
  tutorIdsByModule,
  venues,
  busy,
  onSubmit,
}: ScheduleOneOffDialogProps) {
  const [moduleId, setModuleId] = useState(modules[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [tutorId, setTutorId] = useState("");
  const [venueId, setVenueId] = useState<string | null>(null);
  const [venueText, setVenueText] = useState("");
  const [dtstartLocal, setDtstartLocal] = useState(defaultDtstartLocal);
  const [durationMinutes, setDurationMinutes] = useState(120);
  const [sessionKind, setSessionKind] = useState("workshop");

  useEffect(() => {
    if (!open) return;
    setModuleId(modules[0]?.id ?? "");
    setTitle("");
    setTutorId("");
    setDtstartLocal(defaultDtstartLocal());
  }, [open, modules]);

  const tutorOptions = tutors.filter((t) =>
    (tutorIdsByModule[moduleId] ?? []).includes(t.id),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>One-off session</DialogTitle>
          <DialogDescription>
            Schedule a single session and publish it immediately for the tutor.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <Field label="Module">
            <Select value={moduleId} onValueChange={setModuleId}>
              <SelectTrigger>
                <SelectValue placeholder="Module" />
              </SelectTrigger>
              <SelectContent>
                {modules.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.code} — {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Tutor">
            <Select value={tutorId} onValueChange={setTutorId}>
              <SelectTrigger>
                <SelectValue placeholder="Tutor" />
              </SelectTrigger>
              <SelectContent>
                {tutorOptions.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Start">
            <Input
              type="datetime-local"
              value={dtstartLocal}
              onChange={(e) => setDtstartLocal(e.target.value)}
            />
          </Field>
          <Field label="Duration (minutes)">
            <Input
              type="number"
              min={15}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
            />
          </Field>
          <Field label="Session kind">
            <Input value={sessionKind} onChange={(e) => setSessionKind(e.target.value)} />
          </Field>
          <Field label="Venue">
            <Select
              value={venueId ?? "none"}
              onValueChange={(v) => setVenueId(v === "none" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Venue" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No venue record</SelectItem>
                {venues.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Venue text (optional)">
            <Input value={venueText} onChange={(e) => setVenueText(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={busy || !moduleId || !tutorId || !title.trim()}
            onClick={() =>
              void onSubmit({
                moduleId,
                title,
                tutorId,
                venueId,
                venueText,
                dtstartLocal,
                durationMinutes,
                sessionKind,
              })
            }
          >
            {busy ? "Scheduling…" : "Publish session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
