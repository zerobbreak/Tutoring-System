import { format, parseISO } from "date-fns";
import {
  PRIVATE_FEEDBACK_CATEGORIES,
  PRIVATE_FEEDBACK_CATEGORY_LABELS,
  type PrivateFeedbackCategory,
} from "#/lib/private-session-feedback";
import type { PrivateSessionFeedbackDTO } from "#/server-actions/private-session-feedback";

type PrivateSessionFeedbackDisplayProps = {
  feedback: PrivateSessionFeedbackDTO;
  className?: string;
};

export function PrivateSessionFeedbackDisplay({
  feedback,
}: PrivateSessionFeedbackDisplayProps) {
  const rated = PRIVATE_FEEDBACK_CATEGORIES.filter(
    (key) => feedback.categoryRatings[key] != null,
  );

  return (
    <div className="space-y-3 text-sm">
      {rated.length > 0 ? (
        <ul className="space-y-2">
          {rated.map((key: PrivateFeedbackCategory) => (
            <li
              key={key}
              className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-muted/20 px-3 py-2"
            >
              <span className="text-muted-foreground">
                {PRIVATE_FEEDBACK_CATEGORY_LABELS[key]}
              </span>
              <span className="font-medium tabular-nums">
                {feedback.categoryRatings[key]}/5
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {feedback.note ? (
        <p className="leading-relaxed text-foreground">{feedback.note}</p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        {feedback.author?.full_name ?? "Lecturer"} ·{" "}
        {format(parseISO(feedback.updatedAt), "dd MMM yyyy")}
      </p>
    </div>
  );
}
