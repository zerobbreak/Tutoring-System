import { format, parseISO } from "date-fns";
import { History } from "lucide-react";
import {
  DetailSection,
  EmptyHint,
} from "#/components/lecturer/sheets/detail-section";

export type ClaimTimelineEntry = {
  id: string;
  action_type: string;
  acted_at: string;
  comment: string | null;
  actorLabel: string;
  digitallySigned?: boolean;
};

export function ClaimVerificationTimelineSection({
  timeline,
}: {
  timeline: ClaimTimelineEntry[];
}) {
  return (
    <DetailSection
      title="Verification timeline"
      description="Prior actions on this claim."
      icon={History}
    >
      {timeline.length === 0 ? (
        <EmptyHint>No verification actions yet.</EmptyHint>
      ) : (
        <ol className="space-y-4 border-l-2 border-(--lagoon-deep)/25 pl-4">
          {timeline.map((item) => (
            <li key={item.id} className="relative text-sm">
              <span className="absolute -left-[calc(1rem+5px)] top-1.5 size-2 rounded-full bg-(--lagoon-deep)" />
              <p className="font-medium capitalize text-foreground">
                {item.action_type.replace(/_/g, " ")}
                {item.digitallySigned ? " (signed)" : ""}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {item.actorLabel} ·{" "}
                {format(parseISO(item.acted_at), "dd MMM yyyy, HH:mm")}
              </p>
              {item.comment ? (
                <p className="mt-1.5 leading-relaxed text-muted-foreground">
                  {item.comment}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </DetailSection>
  );
}
