import { z } from "zod";

// Server-only env. Never imported from client components.
const schema = z.object({
  NEXTAUTH_SECRET: z.string().min(16),
  NEXTAUTH_URL: z.string().url(),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  INTERNAL_JWT_SECRET: z.string().min(32),
  API_BASE_URL: z.string().url(),
  DATABASE_URL: z.string().url(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // Fail fast at startup so misconfig surfaces in the dev server log, not later.
  // eslint-disable-next-line no-console
  console.error("Invalid env:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid env configuration");
}
export const serverEnv = parsed.data;
