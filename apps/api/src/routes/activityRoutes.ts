import { Router } from "express";
import { ActivityService } from "../services/activityService.js";
import { asyncHandler } from "./asyncHandler.js";
import { Unauthorized } from "../errors.js";

export const activityRoutes = Router();

activityRoutes.get(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.auth) throw Unauthorized();
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    res.json(await ActivityService.listForWorkspace(req.auth.wsid, limit));
  }),
);
