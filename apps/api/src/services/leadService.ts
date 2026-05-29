import { prisma, Prisma, ActivityType } from "@gtm/database";
import type {
  LeadCreateInput,
  LeadUpdateInput,
  LeadListQuery,
  LeadDto,
  Paginated,
  LeadImportResult,
} from "@gtm/shared";
import { leadCreateSchema } from "@gtm/shared";
import { NotFound } from "../errors.js";

type LeadWithRelations = Prisma.LeadGetPayload<{
  include: {
    pipelineStage: true;
    tags: { include: { tag: true } };
  };
}>;

const leadInclude = {
  pipelineStage: true,
  tags: { include: { tag: true } },
} satisfies Prisma.LeadInclude;

function toDto(l: LeadWithRelations): LeadDto {
  return {
    id: l.id,
    workspaceId: l.workspaceId,
    companyName: l.companyName,
    industry: l.industry,
    website: l.website,
    country: l.country,
    city: l.city,
    contactName: l.contactName,
    role: l.role,
    email: l.email,
    phone: l.phone,
    linkedinUrl: l.linkedinUrl,
    pipelineStageId: l.pipelineStageId,
    pipelineStageName: l.pipelineStage?.name ?? null,
    source: l.source,
    personalization: l.personalization,
    confidenceScore: l.confidenceScore,
    lastContactedAt: l.lastContactedAt?.toISOString() ?? null,
    lastOpenedAt: l.lastOpenedAt?.toISOString() ?? null,
    lastRepliedAt: l.lastRepliedAt?.toISOString() ?? null,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
    tags: l.tags.map((t) => ({
      id: t.tag.id,
      name: t.tag.name,
      color: t.tag.color,
    })),
  };
}

export const LeadService = {
  async list(
    workspaceId: string,
    q: LeadListQuery,
  ): Promise<Paginated<LeadDto>> {
    const where: Prisma.LeadWhereInput = { workspaceId };
    if (q.search) {
      where.OR = [
        { companyName: { contains: q.search, mode: "insensitive" } },
        { contactName: { contains: q.search, mode: "insensitive" } },
        { email: { contains: q.search, mode: "insensitive" } },
      ];
    }
    if (q.stageId) where.pipelineStageId = q.stageId;
    if (q.industry) where.industry = q.industry;
    if (q.tagId) where.tags = { some: { tagId: q.tagId } };
    // semantic filter joins through the pipelineStage relation — used by
    // the Clients view (semantic=WON) and active-only segments.
    if (q.semantic) where.pipelineStage = { semantic: q.semantic };

    const items = await prisma.lead.findMany({
      where,
      include: leadInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: q.limit + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });

    const hasMore = items.length > q.limit;
    const sliced = hasMore ? items.slice(0, q.limit) : items;
    const last = sliced[sliced.length - 1];
    return {
      items: sliced.map(toDto),
      nextCursor: hasMore && last ? last.id : null,
    };
  },

  async get(workspaceId: string, id: string): Promise<LeadDto> {
    const lead = await prisma.lead.findFirst({
      where: { id, workspaceId },
      include: leadInclude,
    });
    if (!lead) throw NotFound("Lead");
    return toDto(lead);
  },

  async create(
    workspaceId: string,
    actorUserId: string,
    input: LeadCreateInput,
  ): Promise<LeadDto> {
    const { tagIds, ...rest } = input;
    const lead = await prisma.$transaction(async (tx) => {
      const created = await tx.lead.create({
        data: {
          ...rest,
          workspaceId,
          ...(tagIds && tagIds.length
            ? { tags: { create: tagIds.map((tagId) => ({ tagId })) } }
            : {}),
        },
        include: leadInclude,
      });
      await tx.activity.create({
        data: {
          workspaceId,
          leadId: created.id,
          actorUserId,
          type: ActivityType.LEAD_CREATED,
          payload: { companyName: created.companyName },
        },
      });
      return created;
    });
    return toDto(lead);
  },

  async update(
    workspaceId: string,
    actorUserId: string,
    id: string,
    input: LeadUpdateInput,
  ): Promise<LeadDto> {
    const { tagIds, ...rest } = input;
    const existing = await prisma.lead.findFirst({ where: { id, workspaceId } });
    if (!existing) throw NotFound("Lead");

    const changedFields = Object.entries(rest)
      .filter(([k, v]) => (existing as Record<string, unknown>)[k] !== v)
      .map(([k]) => k);

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.lead.update({
        where: { id },
        data: {
          ...rest,
          ...(tagIds
            ? {
                tags: {
                  deleteMany: {},
                  create: tagIds.map((tagId) => ({ tagId })),
                },
              }
            : {}),
        },
        include: leadInclude,
      });
      if (changedFields.length > 0) {
        await tx.activity.create({
          data: {
            workspaceId,
            leadId: id,
            actorUserId,
            type: ActivityType.LEAD_UPDATED,
            payload: { changedFields },
          },
        });
      }
      return u;
    });
    return toDto(updated);
  },

  async moveStage(
    workspaceId: string,
    actorUserId: string,
    id: string,
    pipelineStageId: string,
  ): Promise<LeadDto> {
    const lead = await prisma.lead.findFirst({
      where: { id, workspaceId },
      include: { pipelineStage: true },
    });
    if (!lead) throw NotFound("Lead");

    const target = await prisma.pipelineStage.findFirst({
      where: { id: pipelineStageId, workspaceId },
    });
    if (!target) throw NotFound("Pipeline stage");

    if (lead.pipelineStageId === pipelineStageId) {
      return this.get(workspaceId, id);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.lead.update({
        where: { id },
        data: { pipelineStageId },
        include: leadInclude,
      });
      await tx.activity.create({
        data: {
          workspaceId,
          leadId: id,
          actorUserId,
          type: ActivityType.LEAD_STAGE_CHANGED,
          payload: {
            fromStageId: lead.pipelineStageId,
            fromStageName: lead.pipelineStage?.name ?? null,
            toStageId: target.id,
            toStageName: target.name,
          },
        },
      });
      return u;
    });
    return toDto(updated);
  },

  /**
   * Bulk-import leads from a parsed CSV/Excel sheet. Skips rows whose email
   * already exists in the workspace (dedupe), records validation errors per
   * row index, and creates a LEAD_CREATED activity for every imported row.
   *
   * Not done in a single transaction so a single bad row doesn't roll back
   * the whole import — operators typically want partial success with a
   * reported error list.
   */
  async bulkImport(
    workspaceId: string,
    actorUserId: string,
    rawLeads: unknown[],
  ): Promise<LeadImportResult> {
    const result: LeadImportResult = { imported: 0, skipped: 0, errors: [] };

    // Pre-fetch all existing emails in the workspace so dedupe is O(1).
    const existing = await prisma.lead.findMany({
      where: { workspaceId, email: { not: null } },
      select: { email: true },
    });
    const seenEmails = new Set(
      existing.map((l) => l.email!.toLowerCase()),
    );

    for (let i = 0; i < rawLeads.length; i++) {
      const row = rawLeads[i];
      const parsed = leadCreateSchema.safeParse(row);
      if (!parsed.success) {
        result.errors.push({
          row: i + 2, // human-friendly: header is row 1, data starts at row 2
          error: parsed.error.issues.map((iss) => `${iss.path.join(".")}: ${iss.message}`).join("; "),
        });
        continue;
      }
      const data = parsed.data;
      const emailKey = data.email?.toLowerCase();
      if (emailKey && seenEmails.has(emailKey)) {
        result.skipped++;
        continue;
      }

      try {
        const { tagIds, ...rest } = data;
        await prisma.$transaction(async (tx) => {
          const lead = await tx.lead.create({
            data: {
              ...rest,
              workspaceId,
              source: rest.source ?? "import",
              ...(tagIds && tagIds.length
                ? { tags: { create: tagIds.map((tagId) => ({ tagId })) } }
                : {}),
            },
          });
          await tx.activity.create({
            data: {
              workspaceId,
              leadId: lead.id,
              actorUserId,
              type: ActivityType.LEAD_CREATED,
              payload: { companyName: lead.companyName },
            },
          });
        });
        if (emailKey) seenEmails.add(emailKey);
        result.imported++;
      } catch (e) {
        result.errors.push({
          row: i + 2,
          error: e instanceof Error ? e.message : "Unknown error",
        });
      }
    }

    return result;
  },

  async remove(
    workspaceId: string,
    actorUserId: string,
    id: string,
  ): Promise<void> {
    const lead = await prisma.lead.findFirst({ where: { id, workspaceId } });
    if (!lead) throw NotFound("Lead");
    await prisma.$transaction(async (tx) => {
      await tx.activity.create({
        data: {
          workspaceId,
          leadId: null, // lead is about to be cascaded away
          actorUserId,
          type: ActivityType.LEAD_DELETED,
          payload: { companyName: lead.companyName },
        },
      });
      await tx.lead.delete({ where: { id } });
    });
  },
};
