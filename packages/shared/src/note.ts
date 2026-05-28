import { z } from "zod";

export const noteCreateSchema = z.object({
  body: z.string().trim().min(1, "Note cannot be empty").max(10_000),
});
export type NoteCreateInput = z.infer<typeof noteCreateSchema>;

export interface NoteDto {
  id: string;
  leadId: string;
  authorId: string | null;
  authorName: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
}
