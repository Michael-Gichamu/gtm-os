import { Router } from "express";
import { prisma } from "@gtm/database";
import { asyncHandler } from "./asyncHandler.js";
import { Unauthorized } from "../errors.js";

export const workspaceRoutes = Router();

/**
 * Workspace summary — used by the dashboard header and as a sanity check
 * that the JWT bridge is wired correctly.
 */
workspaceRoutes.get(
  "/me",
  asyncHandler(async (req, res) => {
    if (!req.auth) throw Unauthorized();
    const [workspace, leadCount, activeCount, wonCount, lostCount] = await Promise.all([
      prisma.workspace.findUniqueOrThrow({ where: { id: req.auth.wsid } }),
      prisma.lead.count({ where: { workspaceId: req.auth.wsid } }),
      prisma.lead.count({
        where: {
          workspaceId: req.auth.wsid,
          pipelineStage: { semantic: "OPEN" },
        },
      }),
      prisma.lead.count({
        where: {
          workspaceId: req.auth.wsid,
          pipelineStage: { semantic: "WON" },
        },
      }),
      prisma.lead.count({
        where: {
          workspaceId: req.auth.wsid,
          pipelineStage: { semantic: "LOST" },
        },
      }),
    ]);
    res.json({
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      counts: {
        total: leadCount,
        active: activeCount,
        won: wonCount,
        lost: lostCount,
      },
    });
  }),
);
