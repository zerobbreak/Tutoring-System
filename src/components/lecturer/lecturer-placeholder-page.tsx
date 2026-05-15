type LecturerPlaceholderPageProps = {
  title: string;
  description?: string;
};

export function LecturerPlaceholderPage({
  title,
  description = "This section is not built yet. We will implement it together.",
}: LecturerPlaceholderPageProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6 md:p-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        <p className="max-w-xl text-sm text-muted-foreground">{description}</p>
        <div className="mt-8 rounded-xl border border-dashed border-border bg-muted/30 px-6 py-16 text-center text-sm text-muted-foreground">
          Content coming soon
        </div>
      </div>
    </div>
  );
}
