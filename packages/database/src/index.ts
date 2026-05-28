import { PrismaClient } from "@prisma/client";

// Re-export the generated client + enums so consumers depend on @gtm/database,
// not @prisma/client directly. Keeps swap-out (e.g. read replicas, extensions)
// a one-file change.
export * from "@prisma/client";

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
