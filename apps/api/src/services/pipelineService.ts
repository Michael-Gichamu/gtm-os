import { prisma, Prisma } from "@gtm/database";
import type {
  PipelineStageCreateInput,
  PipelineStageUpdateInput,
  PipelineStageDto,
  PipelineReorderInput,
} from "@gtm/shared";
import { NotFound, Conflict } from "../errors.js";

type StageWithCount = Prisma.PipelineStageGetPayload<{
  include: { _count: { select: { leads: true } } };
}>;

function toDto(s: StageWithCount): PipelineStageDto {
  return {
    id: s.id,
    name: s.name,
    position: s.position,
    semantic: s.semantic,
    color: s.color,
    leadCount: s._count.leads,
  };
}

export const PipelineService = {
  async list(workspaceId: string): Promise<PipelineStageDto[]> {
    const stages = await prisma.pipelineStage.findMany({
      where: { workspaceId },
      include: { _count: { select: { leads: true } } },
      orderBy: { position: "asc" },
    });
    return stages.map(toDto);
  },

  async create(
    workspaceId: string,
    input: PipelineStageCreateInput,
  ): Promise<PipelineStageDto> {
    const created = await prisma.pipelineStage.create({
      data: { ...input, workspaceId },
      include: { _count: { select: { leads: true } } },
    });
    return toDto(created);
  },

  async update(
    workspaceId: string,
    id: string,
    input: PipelineStageUpdateInput,
  ): Promise<PipelineStageDto> {
    const existing = await prisma.pipelineStage.findFirst({
      where: { id, workspaceId },
    });
    if (!existing) throw NotFound("Pipeline stage");
    const updated = await prisma.pipelineStage.update({
      where: { id },
      data: input,
      include: { _count: { select: { leads: true } } },
    });
    return toDto(updated);
  },

  async remove(workspaceId: string, id: string): Promise<void> {
    const existing = await prisma.pipelineStage.findFirst({
      where: { id, workspaceId },
      include: { _count: { select: { leads: true } } },
    });
    if (!existing) throw NotFound("Pipeline stage");
    if (existing._count.leads > 0) {
      throw Conflict(
        "Cannot delete a stage that still has leads. Move them first.",
      );
    }
    await prisma.pipelineStage.delete({ where: { id } });
  },

  async reorder(
    workspaceId: string,
    input: PipelineReorderInput,
  ): Promise<PipelineStageDto[]> {
    await prisma.$transaction(
      input.stages.map((s) =>
        prisma.pipelineStage.updateMany({
          where: { id: s.id, workspaceId },
          data: { position: s.position },
        }),
      ),
    );
    return this.list(workspaceId);
  },
};
