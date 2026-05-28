import { Router } from "express";
import { TagService, tagCreateSchema } from "../services/tagService.js";
import { asyncHandler } from "./asyncHandler.js";
import { Unauthorized } from "../errors.js";

export const tagRoutes = Router();

function ws(req: Parameters<Parameters<typeof asyncHandler>[0]>[0]) {
  if (!req.auth) throw Unauthorized();
  return req.auth.wsid;
}

tagRoutes.get(
  "/",
  asyncHandler(async (req, res) => res.json(await TagService.list(ws(req)))),
);

tagRoutes.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = tagCreateSchema.parse(req.body);
    res.status(201).json(await TagService.create(ws(req), input));
  }),
);

tagRoutes.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await TagService.remove(ws(req), req.params.id!);
    res.status(204).send();
  }),
);
