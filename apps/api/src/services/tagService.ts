import { prisma } from "@gtm/database";
import { z } from "zod";

export const tagCreateSchema = z.object({
  name: z.string().trim().min(1).max(40),
  color: z.string().trim().optional(),
});
export type TagCreateInput = z.infer<typeof tagCreateSchema>;

export const TagService = {
  async list(workspaceId: string) {
    return prisma.tag.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" },
    });
  },

  async create(workspaceId: string, input: TagCreateInput) {
    return prisma.tag.create({ data: { ...input, workspaceId } });
  },

  async remove(workspaceId: string, id: string) {
    await prisma.tag.deleteMany({ where: { id, workspaceId } });
  },
};
