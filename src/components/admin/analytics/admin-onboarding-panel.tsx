import type { OnboardingAnalyticsDTO } from "#/server-actions/admin-analytics";

type AdminOnboardingPanelProps = {
  onboarding: OnboardingAnalyticsDTO;
};

function StatusList({
  title,
  items,
}: {
  title: string;
  items: { label: string; count: number }[];
}) {
  const total = items.reduce((s, i) => s + i.count, 0);
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{title}</p>
      {total === 0 ? (
        <p className="text-sm text-muted-foreground">No users in this role.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li
              key={item.label}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-muted-foreground">{item.label}</span>
              <span className="font-medium tabular-nums">{item.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AdminOnboardingPanel({ onboarding }: AdminOnboardingPanelProps) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <StatusList title="Tutors" items={onboarding.tutors} />
      <StatusList title="Lecturers" items={onboarding.lecturers} />
    </div>
  );
}
