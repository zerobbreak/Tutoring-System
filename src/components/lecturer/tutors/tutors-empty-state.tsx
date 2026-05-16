import { UserPlus, Users } from "lucide-react";
import { Button } from "#/components/ui/button";

type TutorsEmptyStateProps = {
  variant: "no-tutors" | "no-results";
  onAssign?: () => void;
};

export function TutorsEmptyState({ variant, onAssign }: TutorsEmptyStateProps) {
  const isNoTutors = variant === "no-tutors";

  return (
    <section className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/15 px-6 py-14 text-center">
      <span className="mb-4 flex size-14 items-center justify-center rounded-full bg-(--lagoon-deep)/10">
        {isNoTutors ? (
          <UserPlus className="size-7 text-(--lagoon-deep)" />
        ) : (
          <Users className="size-7 text-(--lagoon-deep)" />
        )}
      </span>
      <p className="text-base font-medium text-foreground">
        {isNoTutors ? "No tutors on your modules yet" : "No tutors match your search"}
      </p>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {isNoTutors
          ? "Assign tutors from your institution to modules you teach. You can then track sessions, attendance, and claim performance."
          : "Try a different name, email, or module code, or show inactive tutors."}
      </p>
      {isNoTutors && onAssign ? (
        <Button type="button" className="mt-5" onClick={onAssign}>
          <UserPlus className="mr-2 size-4" />
          Assign your first tutor
        </Button>
      ) : null}
    </section>
  );
}
