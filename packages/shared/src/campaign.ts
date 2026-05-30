import { z } from "zod";

// ----------------------------------------------------------------------------
// Status enums — kept as string-literal unions so the shared package does not
// depend on the database client. Must mirror Prisma's CampaignStatus and
// EnrollmentStatus exactly.
// ----------------------------------------------------------------------------

export const campaignStatusSchema = z.enum(["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"]);
export type CampaignStatus = z.infer<typeof campaignStatusSchema>;

export const enrollmentStatusSchema = z.enum([
  "ENROLLED",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "STOPPED_ON_REPLY",
  "STOPPED_MANUAL",
  "BOUNCED",
]);
export type EnrollmentStatus = z.infer<typeof enrollmentStatusSchema>;

// ----------------------------------------------------------------------------
// Campaign
// ----------------------------------------------------------------------------

const settingsBase = {
  dailyCap: z.coerce.number().int().min(1).max(2000).default(50),
  sendWindowStart: z.coerce.number().int().min(0).max(23).default(9),
  sendWindowEnd: z.coerce.number().int().min(0).max(23).default(17),
  jitterMinutes: z.coerce.number().int().min(0).max(180).default(30),
  stopOnReply: z.coerce.boolean().default(true),
};

export const campaignCreateSchema = z
  .object({
    name: z.string().trim().min(1, "Campaign name is required").max(120),
    description: z.string().trim().max(2000).optional(),
    ...settingsBase,
  })
  .refine((v) => v.sendWindowEnd > v.sendWindowStart, {
    message: "Send window end must be after start",
    path: ["sendWindowEnd"],
  });
export type CampaignCreateInput = z.infer<typeof campaignCreateSchema>;

export const campaignUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(2000).optional(),
    dailyCap: settingsBase.dailyCap.optional(),
    sendWindowStart: settingsBase.sendWindowStart.optional(),
    sendWindowEnd: settingsBase.sendWindowEnd.optional(),
    jitterMinutes: settingsBase.jitterMinutes.optional(),
    stopOnReply: settingsBase.stopOnReply.optional(),
  });
export type CampaignUpdateInput = z.infer<typeof campaignUpdateSchema>;

export const campaignStatusUpdateSchema = z.object({
  status: campaignStatusSchema,
});

export interface CampaignDto {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  status: CampaignStatus;
  dailyCap: number;
  sendWindowStart: number;
  sendWindowEnd: number;
  jitterMinutes: number;
  stopOnReply: boolean;
  stepCount: number;
  enrollmentCounts: {
    total: number;
    active: number;     // ENROLLED + ACTIVE
    completed: number;
    stopped: number;    // PAUSED + STOPPED_* + BOUNCED
  };
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  archivedAt: string | null;
}

// ----------------------------------------------------------------------------
// SequenceStep
// ----------------------------------------------------------------------------

export const sequenceStepCreateSchema = z.object({
  order: z.coerce.number().int().min(0).max(50),
  subject: z.string().trim().min(1, "Subject is required").max(300),
  body: z.string().trim().min(1, "Body is required").max(20_000),
  delayDays: z.coerce.number().int().min(0).max(365).default(0),
});
export type SequenceStepCreateInput = z.infer<typeof sequenceStepCreateSchema>;

export const sequenceStepUpdateSchema = sequenceStepCreateSchema.partial();
export type SequenceStepUpdateInput = z.infer<typeof sequenceStepUpdateSchema>;

export const sequenceReorderSchema = z.object({
  steps: z.array(z.object({ id: z.string(), order: z.number().int().min(0) })).min(1),
});
export type SequenceReorderInput = z.infer<typeof sequenceReorderSchema>;

export interface SequenceStepDto {
  id: string;
  campaignId: string;
  order: number;
  subject: string;
  body: string;
  delayDays: number;
  createdAt: string;
  updatedAt: string;
}

// ----------------------------------------------------------------------------
// CampaignEnrollment
// ----------------------------------------------------------------------------

export const enrollLeadsSchema = z.object({
  leadIds: z.array(z.string()).min(1, "Pick at least one lead").max(5000),
});
export type EnrollLeadsInput = z.infer<typeof enrollLeadsSchema>;

export interface EnrollLeadsResult {
  enrolled: number;
  skipped: number;     // already enrolled in this campaign
  errors: Array<{ leadId: string; error: string }>;
}

export const enrollmentStatusUpdateSchema = z.object({
  status: z.enum(["PAUSED", "ACTIVE", "STOPPED_MANUAL"]),
});

export interface CampaignEnrollmentDto {
  id: string;
  workspaceId: string;
  campaignId: string;
  campaignName: string;
  leadId: string;
  leadCompanyName: string;
  leadContactName: string | null;
  leadEmail: string | null;
  currentStep: number;
  nextSendAt: string | null;
  status: EnrollmentStatus;
  enrolledAt: string;
  lastSentAt: string | null;
  completedAt: string | null;
  pausedAt: string | null;
}
