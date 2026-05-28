import { prisma } from "@gtm/database";
import type { ActivityDto, ActivityType } from "@gtm/shared";

export const ActivityService = {
  async listForLead(workspaceId: string, leadId: string): Promise<ActivityDto[]> {
    const rows = await prisma.activity.findMany({
      where: { workspaceId, leadId },
      orderBy: { createdAt: "desc" },
      include: { actor: { select: { id: true, name: true, email: true } } },
      take: 100,
    });
    return rows.map((a) => ({
      id: a.id,
      workspaceId: a.workspaceId,
      leadId: a.leadId,
      actorUserId: a.actorUserId,
      actorName: a.actor?.name ?? a.actor?.email ?? null,
      type: a.type as ActivityType,
      payload: (a.payload as ActivityDto["payload"]) ?? null,
      createdAt: a.createdAt.toISOString(),
    }));
  },

  async listForWorkspace(
    workspaceId: string,
    limit = 50,
  ): Promise<ActivityDto[]> {
    const rows = await prisma.activity.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      include: { actor: { select: { id: true, name: true, email: true } } },
      take: limit,
    });
    return rows.map((a) => ({
      id: a.id,
      workspaceId: a.workspaceId,
      leadId: a.leadId,
      actorUserId: a.actorUserId,
      actorName: a.actor?.name ?? a.actor?.email ?? null,
      type: a.type as ActivityType,
      payload: (a.payload as ActivityDto["payload"]) ?? null,
      createdAt: a.createdAt.toISOString(),
    }));
  },
};
