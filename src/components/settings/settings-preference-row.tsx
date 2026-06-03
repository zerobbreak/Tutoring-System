import type { ReactNode } from "react";
import { Label } from "#/components/ui/label";
import { Switch } from "#/components/ui/switch";

type SettingsPreferenceRowProps = {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  trailing?: ReactNode;
};

export function SettingsPreferenceRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  trailing,
}: SettingsPreferenceRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border/60 bg-card px-4 py-3">
      <div className="min-w-0 flex-1 space-y-0.5">
        <Label htmlFor={id} className="text-foreground">
          {label}
        </Label>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2 pt-0.5">
        {trailing}
        <Switch
          id={id}
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
