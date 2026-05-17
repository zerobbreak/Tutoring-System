export const AUDIT_FEED_CATEGORIES = [
  "ALL",
  "APPROVAL",
  "SCHEDULE",
  "MFA",
  "USER",
  "SECURITY",
] as const;

export type AuditFeedCategory = (typeof AUDIT_FEED_CATEGORIES)[number];

export type AuditFeedActorDTO = {
  id: string;
  fullName: string;
  role: string;
};

export type AuditFeedModuleDTO = {
  id: string;
  code: string;
  name: string;
};

export type AuditLogFeedEntryDTO = {
  id: string;
  source: "verification" | "audit_log" | "schedule" | "mfa";
  occurredAt: string;
  category: AuditFeedCategory;
  eventType: string;
  summary: string;
  actor: AuditFeedActorDTO | null;
  institutionId: string;
  module: AuditFeedModuleDTO | null;
  claimId: string | null;
  entityType: string | null;
  mfaConfirmed: boolean | null;
  ipAddress: string | null;
  comment: string | null;
};

export type AuditLogFeedPageDTO = {
  entries: AuditLogFeedEntryDTO[];
  modules: AuditFeedModuleDTO[];
  actors: AuditFeedActorDTO[];
};
