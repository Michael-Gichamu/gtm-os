import { prisma, Prisma, ActivityType } from "@gtm/database";
import type {
  LeadCreateInput,
  LeadUpdateInput,
  LeadListQuery,
  LeadDto,
  Paginated,
} from "@gtm/shared";
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
