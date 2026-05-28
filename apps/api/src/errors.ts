/**
 * Single error vocabulary used across services and routes.
 * Routes throw; the error middleware shapes the HTTP response.
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const BadRequest = (message: string, details?: unknown) =>
  new AppError(400, "BAD_REQUEST", message, details);
export const Unauthorized = (message = "Unauthorized") =>
  new AppError(401, "UNAUTHORIZED", message);
export const Forbidden = (message = "Forbidden") =>
  new AppError(403, "FORBIDDEN", message);
export const NotFound = (resource = "Resource") =>
  new AppError(404, "NOT_FOUND", `${resource} not found`);
export const Conflict = (message: string) =>
  new AppError(409, "CONFLICT", message);
