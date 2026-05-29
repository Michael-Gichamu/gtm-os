import { z } from "zod";

// Trim then treat empty as undefined — forms always send "" for blank inputs.
const optionalString = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

const optionalEmail = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional()
  .refine(
    (v) => v === undefined || z.string().email().safeParse(v).success,
    { message: "Invalid email" },
  );

const optionalUrl = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional()
  .refine(
    (v) => v === undefined || z.string().url().safeParse(v).success,
    { message: "Invalid URL" },
  );

export const leadCreateSchema = z.object({
  companyName: z.string().trim().min(1, "Company name is required").max(200),
  industry: optionalString,
  website: optionalUrl,
  country: optionalString,
  city: optionalString,
  contactName: optionalString,
  role: optionalString,
  email: optionalEmail,
  phone: optionalString,
  linkedinUrl: optionalUrl,
  pipelineStageId: optionalString,
  source: optionalString,
  personalization: optionalString,
  confidenceScore: z.coerce.number().int().min(0).max(100).optional(),
  tagIds: z.array(z.string()).optional(),
});
export type LeadCreateInput = z.infer<typeof leadCreateSchema>;

export const leadUpdateSchema = leadCreateSchema.partial();
export type LeadUpdateInput = z.infer<typeof leadUpdateSchema>;

export const leadListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  search: z.string().trim().optional(),
  stageId: z.string().optional(),
  industry: z.string().optional(),
  tagId: z.string().optional(),
  // Filter by stage semantic — OPEN = active leads, WON = clients, LOST = lost.
  // Powers the Clients view and any future "active vs. closed" segmenting.
  semantic: z.enum(["OPEN", "WON", "LOST"]).optional(),
});
export type LeadListQuery = z.infer<typeof leadListQuerySchema>;

export const leadMoveStageSchema = z.object({
  pipelineStageId: z.string().min(1),
});
export type LeadMoveStageInput = z.infer<typeof leadMoveStageSchema>;

/** Bulk-import payload — an array of lead drafts. Dedupes by email. */
export const leadImportSchema = z.object({
  leads: z.array(leadCreateSchema).min(1).max(5000),
});
export type LeadImportInput = z.infer<typeof leadImportSchema>;

export interface LeadImportResult {
  imported: number;
  skipped: number; // existing email in workspace
  errors: Array<{ row: number; error: string }>;
}

export interface LeadTagDto {
  id: string;
  name: string;
  color: string | null;
}

export interface LeadDto {
  id: string;
  workspaceId: string;
  companyName: string;
  industry: string | null;
  website: string | null;
  country: string | null;
  city: string | null;
  contactName: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  pipelineStageId: string | null;
  pipelineStageName: string | null;
  source: string | null;
  personalization: string | null;
  confidenceScore: number | null;
  lastContactedAt: string | null;
  lastOpenedAt: string | null;
  lastRepliedAt: string | null;
  createdAt: string;
  updatedAt: string;
  tags: LeadTagDto[];
}
