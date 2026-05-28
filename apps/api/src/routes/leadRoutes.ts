import { Router } from "express";
import {
  leadCreateSchema,
  leadUpdateSchema,
  leadListQuerySchema,
  leadMoveStageSchema,
  noteCreateSchema,
} from "@gtm/shared";
import { LeadService } from "../services/leadService.js";
import { NoteService } from "../services/noteService.js";
import { ActivityService } from "../services/activityService.js";
import { asyncHandler } from "./asyncHandler.js";
import { Unauthorized } from "../errors.js";

export const leadRoutes = Router();

function ctx(req: Parameters<Parameters<typeof asyncHandler>[0]>[0]) {
  if (!req.auth) throw Unauthorized();
  return { workspaceId: req.auth.wsid, userId: req.auth.sub };
}

leadRoutes.get(
  "/",
  asyncHandler(async (req, res) => {
    const { workspaceId } = ctx(req);
    const q = leadListQuerySchema.parse(req.query);
    res.json(await LeadService.list(workspaceId, q));
  }),
);

leadRoutes.post(
  "/",
  asyncHandler(async (req, res) => {
    const { workspaceId, userId } = ctx(req);
    const input = leadCreateSchema.parse(req.body);
    const lead = await LeadService.create(workspaceId, userId, input);
    res.status(201).json(lead);
  }),
);

leadRoutes.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { workspaceId } = ctx(req);
    res.json(await LeadService.get(workspaceId, req.params.id!));
  }),
);

leadRoutes.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const { workspaceId, userId } = ctx(req);
    const input = leadUpdateSchema.parse(req.body);
    res.json(await LeadService.update(workspaceId, userId, req.params.id!, input));
  }),
);

leadRoutes.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const { workspaceId, userId } = ctx(req);
    await LeadService.remove(workspaceId, userId, req.params.id!);
    res.status(204).send();
  }),
);

leadRoutes.post(
  "/:id/move-stage",
  asyncHandler(async (req, res) => {
    const { workspaceId, userId } = ctx(req);
    const input = leadMoveStageSchema.parse(req.body);
    res.json(
      await LeadService.moveStage(
        workspaceId,
        userId,
        req.params.id!,
        input.pipelineStageId,
      ),
    );
  }),
);

leadRoutes.get(
  "/:id/notes",
  asyncHandler(async (req, res) => {
    const { workspaceId } = ctx(req);
    res.json(await NoteService.listForLead(workspaceId, req.params.id!));
  }),
);

leadRoutes.post(
  "/:id/notes",
  asyncHandler(async (req, res) => {
    const { workspaceId, userId } = ctx(req);
    const input = noteCreateSchema.parse(req.body);
    const note = await NoteService.add(workspaceId, req.params.id!, userId, input);
    res.status(201).json(note);
  }),
);

leadRoutes.get(
  "/:id/activities",
  asyncHandler(async (req, res) => {
    const { workspaceId } = ctx(req);
    res.json(await ActivityService.listForLead(workspaceId, req.params.id!));
  }),
);
