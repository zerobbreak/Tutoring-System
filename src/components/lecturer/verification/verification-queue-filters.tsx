import { Search } from "lucide-react";
import { Input } from "#/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";
import type { VerificationModuleOptionDTO } from "#/server-actions/lecturer-verification";

type VerificationQueueFiltersProps = {
  search: string;
  moduleId: string;
  modules: VerificationModuleOptionDTO[];
  onSearchChange: (value: string) => void;
  onModuleChange: (value: string) => void;
};

export function VerificationQueueFilters({
  search,
  moduleId,
  modules,
  onSearchChange,
  onModuleChange,
}: VerificationQueueFiltersProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by tutor or module…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <Select
        value={moduleId || "all"}
        onValueChange={(v) => onModuleChange(v === "all" ? "" : v)}
      >
        <SelectTrigger className="w-full sm:w-[220px]">
          <SelectValue placeholder="All modules" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All modules</SelectItem>
          {modules.map((mod) => (
            <SelectItem key={mod.id} value={mod.id}>
              {mod.code} — {mod.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
