import { Input } from "#/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "#/components/ui/tabs";
import {
  ADMIN_USER_CATEGORIES,
  type AdminUserCategory,
} from "#/server-actions/admin-users";

const CATEGORY_LABELS: Record<AdminUserCategory, string> = {
  all: "All",
  tutors: "Tutors",
  lecturers: "Lecturers",
  admins: "Admins",
  pending: "Pending",
  disabled: "Disabled",
};

type AdminUsersFiltersProps = {
  category: AdminUserCategory;
  search: string;
  onCategoryChange: (category: AdminUserCategory) => void;
  onSearchChange: (value: string) => void;
};

export function AdminUsersFilters({
  category,
  search,
  onCategoryChange,
  onSearchChange,
}: AdminUsersFiltersProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <Tabs
        value={category}
        onValueChange={(v) => onCategoryChange(v as AdminUserCategory)}
      >
        <TabsList className="h-auto flex-wrap">
          {ADMIN_USER_CATEGORIES.map((key) => (
            <TabsTrigger key={key} value={key} className="text-xs sm:text-sm">
              {CATEGORY_LABELS[key]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <Input
        placeholder="Search name or email…"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="max-w-xs"
      />
    </div>
  );
}
