import jwt from "jsonwebtoken";
import { INTERNAL_JWT_TTL_SECONDS, type InternalJwtPayload } from "@gtm/shared";
import { serverEnv } from "../env";

/**
 * Sign a short-lived JWT for an API call. Called server-side only — the
 * shared secret never leaves the server process.
 */
export function signInternalJwt(payload: Omit<InternalJwtPayload, "iat" | "exp">): string {
  return jwt.sign(payload, serverEnv.INTERNAL_JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: INTERNAL_JWT_TTL_SECONDS,
  });
}
