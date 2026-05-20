import * as z from "zod";

export const CONVERSATION_TYPES = [
  "DIRECT",
  "GROUP",
  "SESSION",
  "CLAIM",
  "ATTENDANCE",
] as const;

export type ConversationType = (typeof CONVERSATION_TYPES)[number];

/** Product-facing sidebar categories mapped to DB filters. */
export const MESSAGING_UI_CATEGORIES = [
  { id: "ALL", label: "All" },
  { id: "TUTOR", label: "Tutor discussions" },
  { id: "SESSION", label: "Session queries" },
  { id: "ATTENDANCE", label: "Attendance issues" },
  { id: "ADMIN", label: "Administrative" },
  { id: "DISPUTE", label: "Claim disputes" },
] as const;

export type MessagingUiCategoryId =
  (typeof MESSAGING_UI_CATEGORIES)[number]["id"];

/** Admin messaging hub notice / broadcast types. */
export const NOTICE_TYPES = {
  SYSTEM: "SYSTEM",
  ACADEMIC: "ACADEMIC",
  PAYROLL: "PAYROLL",
  ANNOUNCEMENT: "ANNOUNCEMENT",
  DIRECT: "DIRECT",
} as const;

export type NoticeType = (typeof NOTICE_TYPES)[keyof typeof NOTICE_TYPES];

/** Admin-only sidebar categories. */
export const ADMIN_MESSAGING_UI_CATEGORIES = [
  { id: "ALL", label: "All" },
  { id: "SYSTEM", label: "System notices" },
  { id: "ACADEMIC", label: "Academic notices" },
  { id: "PAYROLL", label: "Payroll notices" },
  { id: "ANNOUNCEMENT", label: "Announcements" },
  { id: "DISPUTE", label: "Disputes" },
] as const;

export type AdminMessagingUiCategoryId =
  (typeof ADMIN_MESSAGING_UI_CATEGORIES)[number]["id"];

export const METADATA_CATEGORY = {
  TUTOR_DISCUSSION: "TUTOR_DISCUSSION",
  SESSION_QUERY: "SESSION_QUERY",
  ATTENDANCE_ISSUE: "ATTENDANCE_ISSUE",
  ADMIN_NOTICE: "ADMIN_NOTICE",
  CLAIM_DISCUSSION: "CLAIM_DISCUSSION",
  CLAIM_DISPUTE: "CLAIM_DISPUTE",
} as const;

export type MetadataCategory =
  (typeof METADATA_CATEGORY)[keyof typeof METADATA_CATEGORY];

const uuid = z.string().uuid();

export const conversationMetadataSchema = z
  .object({
    category: z.enum([
      METADATA_CATEGORY.TUTOR_DISCUSSION,
      METADATA_CATEGORY.SESSION_QUERY,
      METADATA_CATEGORY.ATTENDANCE_ISSUE,
      METADATA_CATEGORY.ADMIN_NOTICE,
      METADATA_CATEGORY.CLAIM_DISCUSSION,
      METADATA_CATEGORY.CLAIM_DISPUTE,
    ]).optional(),
    claim_id: uuid.optional(),
    dispute_id: uuid.optional(),
    scheduled_session_id: uuid.optional(),
    module_id: uuid.optional(),
    tutor_id: uuid.optional(),
    lecturer_id: uuid.optional(),
    notice_type: z.string().optional(),
  })
  .passthrough();

export type ConversationMetadata = z.infer<typeof conversationMetadataSchema>;

export function buildMetadata(
  category: MetadataCategory,
  fields: Omit<ConversationMetadata, "category"> = {},
): ConversationMetadata {
  return conversationMetadataSchema.parse({ category, ...fields });
}

/** Map UI category tab to conversation query filters. */
export function uiCategoryMatchesConversation(
  uiCategory: MessagingUiCategoryId,
  conv: { type: ConversationType; metadata: ConversationMetadata | null },
): boolean {
  if (uiCategory === "ALL") return true;

  const meta = conv.metadata ?? {};
  const cat = meta.category;

  switch (uiCategory) {
    case "TUTOR":
      return conv.type === "DIRECT" && cat !== METADATA_CATEGORY.ADMIN_NOTICE;
    case "SESSION":
      return conv.type === "SESSION" || cat === METADATA_CATEGORY.SESSION_QUERY;
    case "ATTENDANCE":
      return (
        conv.type === "ATTENDANCE" ||
        cat === METADATA_CATEGORY.ATTENDANCE_ISSUE
      );
    case "ADMIN":
      return (
        conv.type === "GROUP" ||
        cat === METADATA_CATEGORY.ADMIN_NOTICE ||
        meta.notice_type === "ADMIN"
      );
    case "DISPUTE":
      return (
        conv.type === "CLAIM" &&
        (cat === METADATA_CATEGORY.CLAIM_DISPUTE ||
          cat === METADATA_CATEGORY.CLAIM_DISCUSSION ||
          Boolean(meta.dispute_id) ||
          Boolean(meta.claim_id))
      );
    default:
      return true;
  }
}

function isAdminNoticeGroup(
  conv: { type: ConversationType; metadata: ConversationMetadata | null },
  noticeType: NoticeType,
): boolean {
  const meta = conv.metadata ?? {};
  return (
    conv.type === "GROUP" &&
    meta.category === METADATA_CATEGORY.ADMIN_NOTICE &&
    meta.notice_type === noticeType
  );
}

function isDisputeConversation(conv: {
  type: ConversationType;
  metadata: ConversationMetadata | null;
}): boolean {
  const meta = conv.metadata ?? {};
  return (
    conv.type === "CLAIM" &&
    (meta.category === METADATA_CATEGORY.CLAIM_DISPUTE ||
      Boolean(meta.dispute_id))
  );
}

/** Map admin messaging hub category tab to conversation filters. */
export function adminUiCategoryMatchesConversation(
  uiCategory: AdminMessagingUiCategoryId,
  conv: { type: ConversationType; metadata: ConversationMetadata | null },
): boolean {
  if (uiCategory === "ALL") return true;

  switch (uiCategory) {
    case "SYSTEM":
      return isAdminNoticeGroup(conv, NOTICE_TYPES.SYSTEM);
    case "ACADEMIC":
      return isAdminNoticeGroup(conv, NOTICE_TYPES.ACADEMIC);
    case "PAYROLL":
      return isAdminNoticeGroup(conv, NOTICE_TYPES.PAYROLL);
    case "ANNOUNCEMENT":
      return (
        isAdminNoticeGroup(conv, NOTICE_TYPES.ANNOUNCEMENT) ||
        (conv.type === "GROUP" &&
          conv.metadata?.category === METADATA_CATEGORY.ADMIN_NOTICE &&
          conv.metadata?.notice_type === "ADMIN")
      );
    case "DISPUTE":
      return isDisputeConversation(conv);
    default:
      return true;
  }
}

export function shortTopicId(id: string | undefined): string {
  return id ? id.slice(0, 8) : "";
}

/** Human-readable thread label from metadata (claim, dispute, etc.). */
export function conversationTopicLabel(
  type: ConversationType,
  metadata: ConversationMetadata | null | undefined,
): string | null {
  const meta = metadata ?? {};
  if (meta.dispute_id) {
    return `Dispute · ${shortTopicId(meta.dispute_id)}`;
  }
  if (meta.claim_id) {
    if (meta.category === METADATA_CATEGORY.SESSION_QUERY || type === "SESSION") {
      return `Session · ${shortTopicId(meta.claim_id)}`;
    }
    if (meta.category === METADATA_CATEGORY.ATTENDANCE_ISSUE || type === "ATTENDANCE") {
      return `Attendance · ${shortTopicId(meta.claim_id)}`;
    }
    if (meta.category === METADATA_CATEGORY.CLAIM_DISPUTE) {
      return `Dispute · ${shortTopicId(meta.claim_id)}`;
    }
    return `Claim · ${shortTopicId(meta.claim_id)}`;
  }
  if (meta.category === METADATA_CATEGORY.TUTOR_DISCUSSION) {
    return "Tutor discussion";
  }
  if (meta.category === METADATA_CATEGORY.ADMIN_NOTICE) {
    return "Admin message";
  }
  return null;
}

export function defaultTitleForType(
  type: ConversationType,
  metadata: ConversationMetadata,
): string {
  const topic = conversationTopicLabel(type, metadata);
  switch (type) {
    case "SESSION":
      return topic ?? "Session query";
    case "CLAIM":
      return topic ?? (metadata.dispute_id ? "Claim dispute" : "Claim discussion");
    case "ATTENDANCE":
      return "Attendance issue";
    case "GROUP": {
      const nt = metadata.notice_type;
      if (nt === NOTICE_TYPES.SYSTEM) return "System notice";
      if (nt === NOTICE_TYPES.ACADEMIC) return "Academic notice";
      if (nt === NOTICE_TYPES.PAYROLL) return "Payroll notice";
      if (nt === NOTICE_TYPES.ANNOUNCEMENT) return "Announcement";
      if (nt === "ADMIN") return "Administrative notice";
      return "Group conversation";
    }
    default:
      return "Direct message";
  }
}
