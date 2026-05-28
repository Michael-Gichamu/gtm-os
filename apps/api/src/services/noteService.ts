import { prisma, ActivityType } from "@gtm/database";
import type { NoteCreateInput, NoteDto } from "@gtm/shared";
import { NotFound } from "../errors.js";

export const NoteService = {
  async listForLead(workspaceId: string, leadId: string): Promise<NoteDto[]> {
    const lead = await prisma.lead.findFirst({ where: { id: leadId, workspaceId } });
    if (!lead) throw NotFound("Lead");
    const notes = await prisma.note.findMany({
      where: { leadId },
      orderBy: { createdAt: "desc" },
      include: { author: { select: { id: true, name: true, email: true } } },
    });
    return notes.map((n) => ({
      id: n.id,
      leadId: n.leadId,
      authorId: n.authorId,
      authorName: n.author?.name ?? n.author?.email ?? null,
      body: n.body,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
    }));
  },

  async add(
    workspaceId: string,
    leadId: string,
    actorUserId: string,
    input: NoteCreateInput,
  ): Promise<NoteDto> {
    const lead = await prisma.lead.findFirst({ where: { id: leadId, workspaceId } });
    if (!lead) throw NotFound("Lead");

    const note = await prisma.$transaction(async (tx) => {
      const n = await tx.note.create({
        data: { leadId, authorId: actorUserId, body: input.body },
        include: { author: { select: { id: true, name: true, email: true } } },
      });
      await tx.activity.create({
        data: {
          workspaceId,
          leadId,
          actorUserId,
          type: ActivityType.NOTE_ADDED,
          payload: {
            noteId: n.id,
            preview: input.body.slice(0, 120),
          },
        },
      });
      return n;
    });

    return {
      id: note.id,
      leadId: note.leadId,
      authorId: note.authorId,
      authorName: note.author?.name ?? note.author?.email ?? null,
      body: note.body,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
    };
  },
};
