import { Link } from "@tanstack/react-router";
import { Loader2, MessageSquare } from "lucide-react";
import { useState } from "react";
import { Button } from "#/components/ui/button";
import { toast } from "#/lib/toast";
import {
  getOrCreateAttendanceConversationFn,
  getOrCreateClaimConversationFn,
  getOrCreateDisputeConversationFn,
  getOrCreateSessionConversationFn,
} from "#/server-actions/messaging";

type WorkflowKind = "session" | "claim" | "attendance" | "dispute";

type WorkflowMessageButtonProps = {
  kind: WorkflowKind;
  claimId?: string;
  disputeId?: string;
  label?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
};

export function WorkflowMessageButton({
  kind,
  claimId,
  disputeId,
  label,
  variant = "outline",
  size = "sm",
  className,
}: WorkflowMessageButtonProps) {
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const defaultLabel =
    kind === "session"
      ? "Discuss session"
      : kind === "attendance"
        ? "Attendance chat"
        : kind === "dispute"
          ? "Dispute thread"
          : "Discuss claim";

  const open = async () => {
    setLoading(true);
    try {
      let id: string;
      if (kind === "dispute") {
        if (!disputeId) throw new Error("Dispute id required");
        const res = await getOrCreateDisputeConversationFn({
          data: { disputeId },
        });
        id = res.conversationId;
      } else if (!claimId) {
        throw new Error("Claim id required");
      } else if (kind === "session") {
        const res = await getOrCreateSessionConversationFn({
          data: { claimId },
        });
        id = res.conversationId;
      } else if (kind === "attendance") {
        const res = await getOrCreateAttendanceConversationFn({
          data: { claimId },
        });
        id = res.conversationId;
      } else {
        const res = await getOrCreateClaimConversationFn({ data: { claimId } });
        id = res.conversationId;
      }
      setConversationId(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open conversation");
    } finally {
      setLoading(false);
    }
  };

  if (conversationId) {
    return (
      <Button variant={variant} size={size} className={className} asChild>
        <Link to="/lecturer/messages" search={{ conversation: conversationId }}>
          <MessageSquare className="mr-2 size-4" />
          Open messages
        </Link>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={loading}
      onClick={() => void open()}
    >
      {loading ? (
        <Loader2 className="mr-2 size-4 animate-spin" />
      ) : (
        <MessageSquare className="mr-2 size-4" />
      )}
      {label ?? defaultLabel}
    </Button>
  );
}
