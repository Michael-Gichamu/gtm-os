import { Router } from "express";
import {
  campaignCreateSchema,
  campaignUpdateSchema,
  campaignStatusUpdateSchema,
  sequenceStepCreateSchema,
  sequenceStepUpdateSchema,
  sequenceReorderSchema,
  enrollLeadsSchema,
  enrollmentStatusUpdateSchema,
} from "@gtm/shared";
import { CampaignService } from "../services/campaignService.js";
import { EnrollmentService } from "../services/enrollmentService.js";
import { asyncHandler } from "./asyncHandler.js";
import { Unauthorized } from "../errors.js";

export const campaignRoutes = Router();

function ctx(req: Parameters<Parameters<typeof asyncHandler>[0]>[0]) {
  if (!req.auth) throw Unauthorized();
  return { workspaceId: req.auth.wsid, userId: req.auth.sub };
}

// ----- Campaigns -----

campaignRoutes.get(
  "/",
  asyncHandler(async (req, res) => {
    const { workspaceId } = ctx(req);
    res.json(await CampaignService.list(workspaceId));
  }),
);

campaignRoutes.post(
  "/",
  asyncHandler(async (req, res) => {
    const { workspaceId } = ctx(req);
    const input = campaignCreateSchema.parse(req.body);
    res.status(201).json(await CampaignService.create(workspaceId, input));
  }),
);

campaignRoutes.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { workspaceId } = ctx(req);
    res.json(await CampaignService.get(workspaceId, req.params.id!));
  }),
);

campaignRoutes.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const { workspaceId } = ctx(req);
    const input = campaignUpdateSchema.parse(req.body);
    res.json(await CampaignService.update(workspaceId, req.params.id!, input));
  }),
);

campaignRoutes.post(
  "/:id/status",
  asyncHandler(async (req, res) => {
    const { workspaceId, userId } = ctx(req);
    const input = campaignStatusUpdateSchema.parse(req.body);
    res.json(await CampaignService.setStatus(workspaceId, userId, req.params.id!, input.status));
  }),
);

campaignRoutes.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const { workspaceId } = ctx(req);
    await CampaignService.remove(workspaceId, req.params.id!);
    res.status(204).send();
  }),
);

// ----- Sequence steps -----

campaignRoutes.get(
  "/:id/steps",
  asyncHandler(async (req, res) => {
    const { workspaceId } = ctx(req);
    res.json(await CampaignService.listSteps(workspaceId, req.params.id!));
  }),
);

campaignRoutes.post(
  "/:id/steps",
  asyncHandler(async (req, res) => {
    const { workspaceId } = ctx(req);
    const input = sequenceStepCreateSchema.parse(req.body);
    res.status(201).json(await CampaignService.addStep(workspaceId, req.params.id!, input));
  }),
);

campaignRoutes.patch(
  "/:id/steps/:stepId",
  asyncHandler(async (req, res) => {
    const { workspaceId } = ctx(req);
    const input = sequenceStepUpdateSchema.parse(req.body);
    res.json(
      await CampaignService.updateStep(workspaceId, req.params.id!, req.params.stepId!, input),
    );
  }),
);

campaignRoutes.delete(
  "/:id/steps/:stepId",
  asyncHandler(async (req, res) => {
    const { workspaceId } = ctx(req);
    await CampaignService.deleteStep(workspaceId, req.params.id!, req.params.stepId!);
    res.status(204).send();
  }),
);

campaignRoutes.post(
  "/:id/steps/reorder",
  asyncHandler(async (req, res) => {
    const { workspaceId } = ctx(req);
    const input = sequenceReorderSchema.parse(req.body);
    res.json(await CampaignService.reorderSteps(workspaceId, req.params.id!, input));
  }),
);

// ----- Enrollments -----

campaignRoutes.get(
  "/:id/enrollments",
  asyncHandler(async (req, res) => {
    const { workspaceId } = ctx(req);
    res.json(await EnrollmentService.listForCampaign(workspaceId, req.params.id!));
  }),
);

campaignRoutes.post(
  "/:id/enrollments",
  asyncHandler(async (req, res) => {
    const { workspaceId, userId } = ctx(req);
    const input = enrollLeadsSchema.parse(req.body);
    res.status(201).json(
      await EnrollmentService.enrollLeads(workspaceId, userId, req.params.id!, input),
    );
  }),
);

campaignRoutes.post(
  "/enrollments/:enrollmentId/status",
  asyncHandler(async (req, res) => {
    const { workspaceId } = ctx(req);
    const input = enrollmentStatusUpdateSchema.parse(req.body);
    res.json(await EnrollmentService.setStatus(workspaceId, req.params.enrollmentId!, input.status));
  }),
);
