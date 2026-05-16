export {
  CONVERSATION_TYPES,
  METADATA_CATEGORY,
  MESSAGING_UI_CATEGORIES,
  buildMetadata,
  defaultTitleForType,
  uiCategoryMatchesConversation,
  conversationMetadataSchema,
  type ConversationMetadata,
  type ConversationType,
  type MessagingUiCategoryId,
  type MetadataCategory,
} from "./metadata-contract";

export type {
  ConversationDTO,
  MessageAttachmentDTO,
  MessageDTO,
  MessageSearchResultDTO,
  ParticipantDTO,
} from "./types";

export { listConversationsFn } from "./list-conversations";
export {
  getConversationMessagesFn,
  markConversationAsReadFn,
  sendMessageFn,
} from "./messages";
export { createConversationFn } from "./create-conversation";
export { searchUsersFn } from "./search-users";
export { togglePinConversationFn } from "./toggle-pin";
export { searchMessagesFn } from "./search-messages";
export {
  getOrCreateAttendanceConversationFn,
  getOrCreateClaimConversationFn,
  getOrCreateDirectConversationFn,
  getOrCreateDisputeConversationFn,
  getOrCreateSessionConversationFn,
} from "./workflow-conversations";
