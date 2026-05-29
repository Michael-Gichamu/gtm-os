import {
  PrismaClient,
  Prisma,
  WorkspaceRole,
  StageSemantic,
  ActivityType,
} from "@prisma/client";

// Re-export the generated client + enums explicitly. We avoid
// `export * from "@prisma/client"` because @prisma/client is a CJS module
// and Turbopack/webpack can't statically analyse a wildcard re-export from
// CJS — every compile emits a warning. Listing the exports we actually use
// is both lighter and clearer about the package surface.
export {
  PrismaClient,
  Prisma,
  WorkspaceRole,
  StageSemantic,
  ActivityType,
};

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

// Single shared client in dev to avoid exhausting the connection pool across
// Next.js hot reloads. In production each process gets its own.
export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "production"
        ? ["error", "warn"]
        : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
