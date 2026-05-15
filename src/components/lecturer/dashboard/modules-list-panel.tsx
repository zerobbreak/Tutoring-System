import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { Skeleton } from "#/components/ui/skeleton";
import type { LecturerModuleDTO } from "#/server-actions/lecturer-dashboard";

type ModulesListPanelProps = {
  booting: boolean;
  modules: LecturerModuleDTO[];
};

export function ModulesListPanel({ booting, modules }: ModulesListPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your modules</CardTitle>
        <CardDescription>
          Modules where you are the assigned lecturer
        </CardDescription>
      </CardHeader>
      <CardContent>
        {booting ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : modules.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No modules are linked to your account yet. Contact your institution
            admin to assign modules.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {modules.map((mod) => (
              <li
                key={mod.id}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <span className="font-medium">{mod.code}</span>
                <span className="text-muted-foreground">{mod.name}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
