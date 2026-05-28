import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { Prisma } from "@gtm/database";
import { AppError } from "../errors.js";
import { logger } from "../logger.js";

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request payload",
        details: err.flatten(),
      },
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P2002 = unique constraint violation
    if (err.code === "P2002") {
      res.status(409).json({
        error: {
          code: "UNIQUE_VIOLATION",
          message: "A record with this value already exists",
          details: err.meta,
        },
      });
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json({
        error: { code: "NOT_FOUND", message: "Record not found" },
      });
      return;
    }
  }

  logger.error({ err, path: req.path }, "Unhandled error");
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Internal server error" },
  });
}
