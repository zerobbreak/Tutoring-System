import { Link } from "@tanstack/react-router";
import { Button } from "#/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { ADMIN_QUICK_ACTIONS } from "./admin-quick-actions";

export function AdminQuickActionsPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick actions</CardTitle>
        <CardDescription>Common admin workflows</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {ADMIN_QUICK_ACTIONS.map((action) => (
          <Button key={action.label} variant="outline" size="sm" asChild>
            <Link to={action.to}>
              <action.icon className="mr-1.5 size-4" />
              {action.label}
              {"soon" in action && action.soon ? (
                <span className="ml-1.5 text-xs text-muted-foreground">
                  (soon)
                </span>
              ) : null}
            </Link>
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
