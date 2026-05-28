import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { INTERNAL_JWT_HEADER, type InternalJwtPayload } from "@gtm/shared";
import { env } from "../env.js";
import { Unauthorized } from "../errors.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: InternalJwtPayload;
    }
  }
}

/**
 * Verifies the short-lived HS256 JWT issued by the web layer.
 * Header: x-internal-auth: <token>
 *
 * The web app signs one token per outgoing request with a 60s TTL — even if
 * a token leaks via logs it expires before it can be replayed meaningfully.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const raw = req.header(INTERNAL_JWT_HEADER);
  if (!raw) return next(Unauthorized("Missing auth header"));

  try {
    const decoded = jwt.verify(raw, env.INTERNAL_JWT_SECRET, {
      algorithms: ["HS256"],
    }) as InternalJwtPayload;
    if (!decoded.sub || !decoded.wsid) {
      return next(Unauthorized("Invalid token claims"));
    }
    req.auth = decoded;
    next();
  } catch (err) {
    next(Unauthorized(err instanceof Error ? err.message : "Invalid token"));
  }
}
