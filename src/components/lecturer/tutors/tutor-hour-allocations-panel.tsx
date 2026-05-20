import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
import { toast } from "#/lib/toast";
import type { TutorHourBudgetSummary } from "#/lib/tutor-hour-budget";
import {
  deleteTutorHourAllocationFn,
  getLecturerTutorHourBudgetFn,
  listInstitutionAcademicTermsFn,
  listTutorAllocationsFn,
  upsertTutorHourAllocationFn,
  type TutorHourAllocationDTO,
} from "#/server-actions/tutor-allocations";

type ModuleOption = { id: string; code: string; name: string };

type TutorHourAllocationsPanelProps = {
  tutorId: string;
  modules: ModuleOption[];
};

export function TutorHourAllocationsPanel({
  tutorId,
  modules,
}: TutorHourAllocationsPanelProps) {
  const [academicTerms, setAcademicTerms] = useState<
    { id: string; label: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [allocations, setAllocations] = useState<TutorHourAllocationDTO[]>([]);
  const [budget, setBudget] = useState<TutorHourBudgetSummary | null>(null);
  const [moduleId, setModuleId] = useState("");
  const [termId, setTermId] = useState("");
  const [hours, setHours] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [allocs, summary, terms] = await Promise.all([
        listTutorAllocationsFn({ data: { tutorId } }),
        getLecturerTutorHourBudgetFn({ data: { tutorId } }),
        listInstitutionAcademicTermsFn(),
      ]);
      setAllocations(allocs);
      setBudget(summary);
      setAcademicTerms(terms);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load allocations");
    } finally {
      setLoading(false);
    }
  }, [tutorId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    if (!moduleId || !termId) {
      toast.error("Select a module and semester.");
      return;
    }
    const n = Number.parseFloat(hours);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Enter a positive number of hours.");
      return;
    }
    setBusy(true);
    try {
      await upsertTutorHourAllocationFn({
        data: {
          tutorId,
          moduleId,
          academicTermId: termId,
          allocatedHours: n,
        },
      });
      toast.success("Allocation saved.");
      setHours("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save allocation");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (allocationId: string) => {
    if (!window.confirm("Remove this hour allocation?")) return;
    setBusy(true);
    try {
      await deleteTutorHourAllocationFn({ data: { allocationId } });
      toast.success("Allocation removed.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove allocation");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading hour allocations…
      </div>
    );
  }

  const totals = budget?.totals;

  return (
    <div className="space-y-4">
      {totals && totals.allocatedHours > 0 ? (
        <p className="text-sm text-muted-foreground">
          Reserved{" "}
          <span className="font-medium text-foreground">
            {totals.reservedHours}h
          </span>{" "}
          of {totals.allocatedHours}h allocated
          {totals.availableHours >= 0
            ? ` (${totals.availableHours}h available)`
            : ` (${Math.abs(totals.availableHours)}h over)`}
          . Worked: {totals.workedHours}h ({totals.utilizationPercent}%).
        </p>
      ) : null}

      {allocations.length > 0 ? (
        <ul className="space-y-2">
          {allocations.map((a) => {
            const row = budget?.byModule.find(
              (m) =>
                m.moduleId === a.moduleId &&
                m.academicTermId === a.academicTermId,
            );
            return (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/70 px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-medium">{a.moduleCode}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {a.academicTermLabel} · {a.allocatedHours}h cap
                  </span>
                  {row ? (
                    <span className="block text-xs text-muted-foreground">
                      {row.reservedHours}h reserved · {row.workedHours}h worked
                    </span>
                  ) : null}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-destructive"
                  disabled={busy}
                  onClick={() => void handleDelete(a.id)}
                >
                  Remove
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          No hour caps set for this tutor yet.
        </p>
      )}

      {modules.length > 0 && academicTerms.length > 0 ? (
        <div className="grid gap-3 rounded-lg border border-dashed border-border/80 bg-muted/20 p-3">
          <p className="text-xs font-medium text-muted-foreground">
            Add or update allocation
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="grid gap-1">
              <Label>Module</Label>
              <Select
                value={moduleId}
                onValueChange={setModuleId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Module" />
                </SelectTrigger>
                <SelectContent>
                  {modules.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label>Semester</Label>
              <Select value={termId} onValueChange={setTermId}>
                <SelectTrigger>
                  <SelectValue placeholder="Term" />
                </SelectTrigger>
                <SelectContent>
                  {academicTerms.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label htmlFor="alloc-hours">Allocated hours</Label>
              <Input
                id="alloc-hours"
                type="number"
                min={0.5}
                step={0.5}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="40"
              />
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => void handleSave()}
          >
            {busy ? "Saving…" : "Save allocation"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
