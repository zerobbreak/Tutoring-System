import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { cn } from "#/lib/utils";

/** Max list rows in dashboard side panels so cards stay aligned in a row. */
export const DASHBOARD_PANEL_PREVIEW_LIMIT = 3;

/** Minimum list body height (≈3 rows) for equal card height in a grid row. */
export const DASHBOARD_PANEL_LIST_MIN_H =
  "min-h-[8.75rem]" as const;

type DashboardPanelCardProps = {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function DashboardPanelCard({
  title,
  description,
  action,
  children,
  footer,
  className,
}: DashboardPanelCardProps) {
  return (
    <Card className={cn("flex h-full flex-col", className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-4">
        <div className="min-w-0 space-y-1">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-2 pt-0 text-sm">
        {children}
        {footer ? <div className="mt-auto pt-1">{footer}</div> : null}
      </CardContent>
    </Card>
  );
}
