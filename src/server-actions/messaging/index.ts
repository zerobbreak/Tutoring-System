export {
  CONVERSATION_TYPES,
  METADATA_CATEGORY,
  MESSAGING_UI_CATEGORIES,
  ADMIN_MESSAGING_UI_CATEGORIES,
  NOTICE_TYPES,
  buildMetadata,
  conversationTopicLabel,
  defaultTitleForType,
  shortTopicId,
  uiCategoryMatchesConversation,
  adminUiCategoryMatchesConversation,
  conversationMetadataSchema,
  type ConversationMetadata,
  type ConversationType,
  type MessagingUiCategoryId,
  type AdminMessagingUiCategoryId,
  type MetadataCategory,
  type NoticeType,
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
export { deleteConversationFn } from "./delete-conversation";
export { searchUsersFn } from "./search-users";
export { togglePinConversationFn } from "./toggle-pin";
export { searchMessagesFn } from "./search-messages";
export {
  getOrCreateAttendanceConversationFn,
  getOrCreateClaimConversationFn,
  getOrCreateDirectConversationFn,
  getOrCreateDisputeConversationFn,
  getOrCreatePeerConversationFn,
  getOrCreateSessionConversationFn,
} from "./workflow-conversations";

export {
  searchInstitutionUsersForAdminFn,
  createAdminDirectConversationFn,
  createInstitutionNoticeFn,
  listOpenDisputesForMessagingFn,
  joinAdminDisputeConversationFn,
  type AdminMessagingUserDTO,
  type AdminDisputeMessagingRowDTO,
} from "./admin-messaging";
