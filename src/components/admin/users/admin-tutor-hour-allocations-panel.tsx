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
import type { InstitutionModuleOptionDTO } from "#/server-actions/admin-users";
import {
  adminDeleteTutorHourAllocationFn,
  adminGetTutorHourBudgetFn,
  adminListInstitutionAcademicTermsFn,
  adminListTutorAllocationsFn,
  adminUpsertTutorHourAllocationFn,
  type TutorHourAllocationDTO,
} from "#/server-actions/tutor-allocations";

type AdminTutorHourAllocationsPanelProps = {
  tutorId: string;
  modules: InstitutionModuleOptionDTO[];
};

export function AdminTutorHourAllocationsPanel({
  tutorId,
  modules,
}: AdminTutorHourAllocationsPanelProps) {
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
        adminListTutorAllocationsFn({ data: { tutorId } }),
        adminGetTutorHourBudgetFn({ data: { tutorId } }),
        adminListInstitutionAcademicTermsFn(),
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
      await adminUpsertTutorHourAllocationFn({
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
      await adminDeleteTutorHourAllocationFn({ data: { allocationId } });
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
          Reserved <span className="font-medium text-foreground">{totals.reservedHours}h</span> of {totals.allocatedHours}h allocated
          {totals.availableHours >= 0
            ? ` (${totals.availableHours}h available)`
            : ` (${Math.abs(totals.availableHours)}h over)`}
          . Worked: {totals.workedHours}h ({totals.utilizationPercent}%).
        </p>
      ) : null}

      {allocations.length > 0 ? (
        <ul className="space-y-2">
          {allocations.map((allocation) => (
            <li
              key={allocation.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/70 px-3 py-2 text-sm"
            >
              <span>
                <span className="font-medium">{allocation.moduleCode}</span>
                <span className="text-muted-foreground">
                  {' '}· {allocation.academicTermLabel} · {allocation.allocatedHours}h cap
                </span>
                <span className="block text-xs text-muted-foreground">
                  {allocation.moduleName}
                </span>
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="text-destructive"
                disabled={busy}
                onClick={() => void handleDelete(allocation.id)}
              >
                Remove
              </Button>
            </li>
          ))}
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
              <Select value={moduleId} onValueChange={setModuleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Module" />
                </SelectTrigger>
                <SelectContent>
                  {modules.map((module) => (
                    <SelectItem key={module.id} value={module.id}>
                      {module.code}
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
                  {academicTerms.map((term) => (
                    <SelectItem key={term.id} value={term.id}>
                      {term.label}
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
          <Button type="button" size="sm" disabled={busy} onClick={() => void handleSave()}>
            {busy ? "Saving…" : "Save allocation"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
