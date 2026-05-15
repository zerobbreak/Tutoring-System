import { Link } from "@tanstack/react-router";
import { Button } from "#/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { LECTURER_QUICK_ACTIONS } from "./quick-actions";

export function QuickActionsPanel() {
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Quick actions</CardTitle>
        <CardDescription>Common lecturer workflows</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {LECTURER_QUICK_ACTIONS.map((action) => (
          <Button key={action.to} variant="outline" size="sm" asChild>
            <Link to={action.to}>
              <action.icon className="mr-1.5 size-4" />
              {action.label}
            </Link>
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
