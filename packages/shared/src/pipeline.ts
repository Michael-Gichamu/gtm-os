import { z } from "zod";

export const stageSemanticSchema = z.enum(["OPEN", "WON", "LOST"]);
export type StageSemantic = z.infer<typeof stageSemanticSchema>;

export const pipelineStageCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  position: z.coerce.number().int().min(0),
  semantic: stageSemanticSchema.default("OPEN"),
  color: z.string().trim().optional(),
});
export type PipelineStageCreateInput = z.infer<typeof pipelineStageCreateSchema>;

export const pipelineStageUpdateSchema = pipelineStageCreateSchema.partial();
export type PipelineStageUpdateInput = z.infer<typeof pipelineStageUpdateSchema>;

export const pipelineReorderSchema = z.object({
  stages: z
    .array(z.object({ id: z.string(), position: z.number().int().min(0) }))
    .min(1),
});
export type PipelineReorderInput = z.infer<typeof pipelineReorderSchema>;

export interface PipelineStageDto {
  id: string;
  name: string;
  position: number;
  semantic: StageSemantic;
  color: string | null;
  leadCount: number;
}
