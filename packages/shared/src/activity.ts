/**
 * Activity types mirror the Prisma enum. Kept as a string-literal union so
 * the shared package does not depend on the database client.
 *
 * Payload shapes are documented per-type — write them through the
 * `ActivityPayloads` map so producers stay consistent.
 */
export const activityTypes = [
  "LEAD_CREATED",
  "LEAD_UPDATED",
  "LEAD_STAGE_CHANGED",
  "LEAD_TAGGED",
  "LEAD_UNTAGGED",
  "LEAD_DELETED",
  "NOTE_ADDED",
  "EMAIL_SENT",
  "EMAIL_OPENED",
  "EMAIL_CLICKED",
  "REPLY_RECEIVED",
  "BOUNCE_RECEIVED",
  "CAMPAIGN_STARTED",
  "CAMPAIGN_COMPLETED",
  "FOLLOWUP_SCHEDULED",
  "FOLLOWUP_SENT",
] as const;
export type ActivityType = (typeof activityTypes)[number];

export interface ActivityPayloads {
  LEAD_CREATED: { companyName: string };
  LEAD_UPDATED: { changedFields: string[] };
  LEAD_STAGE_CHANGED: {
    fromStageId: string | null;
    fromStageName: string | null;
    toStageId: string;
    toStageName: string;
  };
  LEAD_TAGGED: { tagId: string; tagName: string };
  LEAD_UNTAGGED: { tagId: string; tagName: string };
  LEAD_DELETED: { companyName: string };
  NOTE_ADDED: { noteId: string; preview: string };
  // ---- Reserved for later phases ----
  EMAIL_SENT: { campaignId: string; subject: string };
  EMAIL_OPENED: { campaignId: string };
  EMAIL_CLICKED: { campaignId: string; url: string };
  REPLY_RECEIVED: { campaignId: string; sentiment?: string };
  BOUNCE_RECEIVED: { campaignId: string; reason?: string };
  CAMPAIGN_STARTED: { campaignId: string };
  CAMPAIGN_COMPLETED: { campaignId: string };
  FOLLOWUP_SCHEDULED: { campaignId: string; runAt: string };
  FOLLOWUP_SENT: { campaignId: string; step: number };
}

export interface ActivityDto<T extends ActivityType = ActivityType> {
  id: string;
  workspaceId: string;
  leadId: string | null;
  actorUserId: string | null;
  actorName: string | null;
  type: T;
  payload: ActivityPayloads[T] | null;
  createdAt: string;
}
