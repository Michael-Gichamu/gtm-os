import { prisma, Prisma, CampaignStatus, ActivityType } from "@gtm/database";
import type {
  CampaignCreateInput,
  CampaignUpdateInput,
  CampaignDto,
  SequenceStepCreateInput,
  SequenceStepUpdateInput,
  SequenceStepDto,
  SequenceReorderInput,
  CampaignStatus as CampaignStatusZ,
} from "@gtm/shared";
import { NotFound, BadRequest, Conflict } from "../errors.js";

type CampaignWithCounts = Prisma.CampaignGetPayload<{
  include: {
    _count: { select: { steps: true; enrollments: true } };
    enrollments: { select: { status: true } };
  };
}>;

function toDto(c: CampaignWithCounts): CampaignDto {
  const counts = c.enrollments.reduce(
    (acc, e) => {
      acc.total++;
      if (e.status === "ENROLLED" || e.status === "ACTIVE") acc.active++;
      else if (e.status === "COMPLETED") acc.completed++;
      else acc.stopped++;
      return acc;
    },
    { total: 0, active: 0, completed: 0, stopped: 0 },
  );
  return {
    id: c.id,
    workspaceId: c.workspaceId,
    name: c.name,
    description: c.description,
    status: c.status,
    dailyCap: c.dailyCap,
    sendWindowStart: c.sendWindowStart,
    sendWindowEnd: c.sendWindowEnd,
    jitterMinutes: c.jitterMinutes,
    stopOnReply: c.stopOnReply,
    stepCount: c._count.steps,
    enrollmentCounts: counts,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    startedAt: c.startedAt?.toISOString() ?? null,
    archivedAt: c.archivedAt?.toISOString() ?? null,
  };
}

const include = {
  _count: { select: { steps: true, enrollments: true } },
  enrollments: { select: { status: true } },
} satisfies Prisma.CampaignInclude;

export const CampaignService = {
  async list(workspaceId: string): Promise<CampaignDto[]> {
    const rows = await prisma.campaign.findMany({
      where: { workspaceId },
      include,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });
    return rows.map(toDto);
  },

  async get(workspaceId: string, id: string): Promise<CampaignDto> {
    const c = await prisma.campaign.findFirst({ where: { id, workspaceId }, include });
    if (!c) throw NotFound("Campaign");
    return toDto(c);
  },

  async create(workspaceId: string, input: CampaignCreateInput): Promise<CampaignDto> {
    const created = await prisma.campaign.create({
      data: { ...input, workspaceId },
      include,
    });
    return toDto(created);
  },

  async update(
    workspaceId: string,
    id: string,
    input: CampaignUpdateInput,
  ): Promise<CampaignDto> {
    const existing = await prisma.campaign.findFirst({ where: { id, workspaceId } });
    if (!existing) throw NotFound("Campaign");
    if (existing.status === "ARCHIVED") {
      throw BadRequest("Cannot edit an archived campaign.");
    }
    // Defend the send-window invariant if either bound is being changed.
    const nextStart = input.sendWindowStart ?? existing.sendWindowStart;
    const nextEnd = input.sendWindowEnd ?? existing.sendWindowEnd;
    if (nextEnd <= nextStart) {
      throw BadRequest("Send window end must be after start.");
    }
    const updated = await prisma.campaign.update({
      where: { id },
      data: input,
      include,
    });
    return toDto(updated);
  },

  async setStatus(
    workspaceId: string,
    actorUserId: string,
    id: string,
    status: CampaignStatusZ,
  ): Promise<CampaignDto> {
    const existing = await prisma.campaign.findFirst({
      where: { id, workspaceId },
      include: { _count: { select: { steps: true } } },
    });
    if (!existing) throw NotFound("Campaign");

    // Guard the activation: you can't run a campaign with no steps.
    if (status === CampaignStatus.ACTIVE && existing._count.steps === 0) {
      throw BadRequest(
        "Add at least one sequence step before activating the campaign.",
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const c = await tx.campaign.update({
        where: { id },
        data: {
          status,
          ...(status === CampaignStatus.ACTIVE && !existing.startedAt
            ? { startedAt: new Date() }
            : {}),
          ...(status === CampaignStatus.ARCHIVED ? { archivedAt: new Date() } : {}),
        },
        include,
      });
      if (status === CampaignStatus.ACTIVE && !existing.startedAt) {
        await tx.activity.create({
          data: {
            workspaceId,
            actorUserId,
            type: ActivityType.CAMPAIGN_STARTED,
            payload: { campaignId: id },
          },
        });
      }
      return c;
    });
    return toDto(updated);
  },

  async remove(workspaceId: string, id: string): Promise<void> {
    const existing = await prisma.campaign.findFirst({
      where: { id, workspaceId },
      include: { _count: { select: { enrollments: true } } },
    });
    if (!existing) throw NotFound("Campaign");
    if (existing._count.enrollments > 0) {
      throw Conflict(
        "Cannot delete a campaign with enrollments. Archive it instead.",
      );
    }
    await prisma.campaign.delete({ where: { id } });
  },

  // ----- Sequence step management -----

  async listSteps(workspaceId: string, campaignId: string): Promise<SequenceStepDto[]> {
    await this.assertOwned(workspaceId, campaignId);
    const rows = await prisma.sequenceStep.findMany({
      where: { campaignId },
      orderBy: { order: "asc" },
    });
    return rows.map((s) => ({
      id: s.id,
      campaignId: s.campaignId,
      order: s.order,
      subject: s.subject,
      body: s.body,
      delayDays: s.delayDays,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }));
  },

  async addStep(
    workspaceId: string,
    campaignId: string,
    input: SequenceStepCreateInput,
  ): Promise<SequenceStepDto> {
    await this.assertOwned(workspaceId, campaignId);
    const created = await prisma.sequenceStep.create({
      data: { ...input, campaignId },
    });
    return {
      id: created.id,
      campaignId: created.campaignId,
      order: created.order,
      subject: created.subject,
      body: created.body,
      delayDays: created.delayDays,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  },

  async updateStep(
    workspaceId: string,
    campaignId: string,
    stepId: string,
    input: SequenceStepUpdateInput,
  ): Promise<SequenceStepDto> {
    await this.assertOwned(workspaceId, campaignId);
    const updated = await prisma.sequenceStep.update({
      where: { id: stepId, campaignId },
      data: input,
    });
    return {
      id: updated.id,
      campaignId: updated.campaignId,
      order: updated.order,
      subject: updated.subject,
      body: updated.body,
      delayDays: updated.delayDays,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  },

  async deleteStep(
    workspaceId: string,
    campaignId: string,
    stepId: string,
  ): Promise<void> {
    await this.assertOwned(workspaceId, campaignId);
    await prisma.sequenceStep.delete({ where: { id: stepId, campaignId } });
  },

  async reorderSteps(
    workspaceId: string,
    campaignId: string,
    input: SequenceReorderInput,
  ): Promise<SequenceStepDto[]> {
    await this.assertOwned(workspaceId, campaignId);
    // Two-phase update: push everything into negative positions first to dodge
    // the (campaignId, order) unique, then settle into the requested ones.
    await prisma.$transaction([
      ...input.steps.map((s, idx) =>
        prisma.sequenceStep.updateMany({
          where: { id: s.id, campaignId },
          data: { order: -1 - idx },
        }),
      ),
      ...input.steps.map((s) =>
        prisma.sequenceStep.updateMany({
          where: { id: s.id, campaignId },
          data: { order: s.order },
        }),
      ),
    ]);
    return this.listSteps(workspaceId, campaignId);
  },

  async assertOwned(workspaceId: string, campaignId: string): Promise<void> {
    const exists = await prisma.campaign.count({ where: { id: campaignId, workspaceId } });
    if (!exists) throw NotFound("Campaign");
  },
};
