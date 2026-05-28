import { Router } from "express";
import {
  pipelineStageCreateSchema,
  pipelineStageUpdateSchema,
  pipelineReorderSchema,
} from "@gtm/shared";
import { PipelineService } from "../services/pipelineService.js";
import { asyncHandler } from "./asyncHandler.js";
import { Unauthorized } from "../errors.js";

export const pipelineRoutes = Router();

function ws(req: Parameters<Parameters<typeof asyncHandler>[0]>[0]) {
  if (!req.auth) throw Unauthorized();
  return req.auth.wsid;
}

pipelineRoutes.get(
  "/stages",
  asyncHandler(async (req, res) => res.json(await PipelineService.list(ws(req)))),
);

pipelineRoutes.post(
  "/stages",
  asyncHandler(async (req, res) => {
    const input = pipelineStageCreateSchema.parse(req.body);
    res.status(201).json(await PipelineService.create(ws(req), input));
  }),
);

pipelineRoutes.patch(
  "/stages/:id",
  asyncHandler(async (req, res) => {
    const input = pipelineStageUpdateSchema.parse(req.body);
    res.json(await PipelineService.update(ws(req), req.params.id!, input));
  }),
);

pipelineRoutes.delete(
  "/stages/:id",
  asyncHandler(async (req, res) => {
    await PipelineService.remove(ws(req), req.params.id!);
    res.status(204).send();
  }),
);

pipelineRoutes.post(
  "/stages/reorder",
  asyncHandler(async (req, res) => {
    const input = pipelineReorderSchema.parse(req.body);
    res.json(await PipelineService.reorder(ws(req), input));
  }),
);
