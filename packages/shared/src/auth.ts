/**
 * Shape of the JWT the web app signs and the Express API verifies.
 * Tokens are short-lived (60s) — issued per-request to keep the blast radius
 * of a leak minimal.
 */
export interface InternalJwtPayload {
  /** User id (NextAuth user.id). */
  sub: string;
  /** Workspace id this request acts on behalf of. */
  wsid: string;
  /** Optional role within the workspace. */
  role?: "OWNER" | "ADMIN" | "MEMBER";
  iat?: number;
  exp?: number;
}

export const INTERNAL_JWT_HEADER = "x-internal-auth";
export const INTERNAL_JWT_TTL_SECONDS = 60;
