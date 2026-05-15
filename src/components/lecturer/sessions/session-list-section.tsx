import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";

type SessionListSectionProps = {
  title: string;
  description?: string;
  count: number;
  emptyMessage: string;
  children: ReactNode;
};

export function SessionListSection({
  title,
  description,
  count,
  emptyMessage,
  children,
}: SessionListSectionProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          {title}
          <span className="ml-2 font-normal text-muted-foreground">({count})</span>
        </CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        {count === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <ul className="flex flex-col gap-2">{children}</ul>
        )}
      </CardContent>
    </Card>
  );
}
