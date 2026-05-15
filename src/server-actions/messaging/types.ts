import type { ConversationMetadata, ConversationType } from "./metadata-contract";

export type ConversationDTO = {
  id: string;
  title: string | null;
  type: ConversationType;
  metadata: ConversationMetadata;
  updated_at: string;
  last_message?: MessageDTO;
  unread_count: number;
  participants: ParticipantDTO[];
  my_is_pinned: boolean;
};

export type ParticipantDTO = {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
  last_read_at: string | null;
  is_pinned: boolean;
};

export type MessageAttachmentDTO = {
  id: string;
  file_name: string;
  file_url: string;
  mime_type: string;
  size_bytes: number | null;
};

export type MessageDTO = {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  parent_message_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  attachments: MessageAttachmentDTO[];
};

export type MessageSearchResultDTO = {
  message_id: string;
  conversation_id: string;
  content: string;
  created_at: string;
  sender_id: string;
  rank: number;
};
