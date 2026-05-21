import { Loader2, Star } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "#/components/ui/button";
import { Label } from "#/components/ui/label";
import {
  PRIVATE_FEEDBACK_CATEGORIES,
  PRIVATE_FEEDBACK_CATEGORY_LABELS,
  type PrivateFeedbackCategory,
} from "#/lib/private-session-feedback";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";
import {
  getPrivateSessionFeedbackForClaimFn,
  upsertPrivateSessionFeedbackFn,
  type PrivateSessionFeedbackDTO,
} from "#/server-actions/private-session-feedback";
import type { CategoryRatingsInput } from "#/lib/private-session-feedback";

type PrivateSessionFeedbackFormProps = {
  claimId: string;
  onSaved?: () => void;
};

function emptyRatings(): CategoryRatingsInput {
  return {};
}

export function PrivateSessionFeedbackForm({
  claimId,
  onSaved,
}: PrivateSessionFeedbackFormProps) {
  const [ratings, setRatings] = useState<CategoryRatingsInput>(emptyRatings);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState<PrivateSessionFeedbackDTO | null>(
    null,
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const row = await getPrivateSessionFeedbackForClaimFn({
        data: { claimId },
      });
      setExisting(row);
      if (row) {
        setRatings({ ...row.categoryRatings });
        setNote(row.note ?? "");
      } else {
        setRatings(emptyRatings());
        setNote("");
      }
    } catch {
      setExisting(null);
    } finally {
      setLoading(false);
    }
  }, [claimId]);

  useEffect(() => {
    void load();
  }, [load]);

  const setRating = (key: PrivateFeedbackCategory, value: number | undefined) => {
    setRatings((prev) => {
      const next = { ...prev };
      if (value == null) delete next[key];
      else next[key] = value;
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await upsertPrivateSessionFeedbackFn({
        data: {
          claimId,
          categoryRatings: ratings,
          note: note.trim() || undefined,
        },
      });
      setExisting(saved);
      toast.success("Private feedback saved.");
      onSaved?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save feedback");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Only visible to you, the tutor, and administrators — not shared publicly.
        {existing ? " You can update this feedback anytime." : null}
      </p>
      <div className="space-y-3">
        {PRIVATE_FEEDBACK_CATEGORIES.map((key) => {
          const current = ratings[key];
          return (
            <div
              key={key}
              className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <Label className="text-xs font-medium text-muted-foreground">
                {PRIVATE_FEEDBACK_CATEGORY_LABELS[key]}
              </Label>
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-label={`${PRIVATE_FEEDBACK_CATEGORY_LABELS[key]}: ${n} of 5`}
                    className="rounded p-0.5 text-muted-foreground transition-colors hover:text-amber-500"
                    onClick={() =>
                      setRating(key, current === n ? undefined : n)
                    }
                  >
                    <Star
                      className={cn(
                        "size-5",
                        current != null && n <= current
                          ? "fill-amber-400 text-amber-500"
                          : "fill-transparent",
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="space-y-2">
        <Label htmlFor="private-feedback-note">Written note (optional)</Label>
        <textarea
          id="private-feedback-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="e.g. Good student engagement. Attendance handling improved significantly."
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </div>
      <Button
        type="button"
        className="w-full sm:w-auto"
        disabled={saving}
        onClick={() => void handleSave()}
      >
        {saving ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          "Save private feedback"
        )}
      </Button>
    </div>
  );
}
