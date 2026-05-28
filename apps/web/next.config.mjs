import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Next.js only auto-loads .env from this app's own directory, but GTM-OS keeps
// a single .env at the monorepo root (shared with the API). Load it here so
// process.env is populated for dev, build, and runtime before any route module
// (NextAuth, env validation) is evaluated.
const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, "../../.env") });

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pull source straight from the workspace packages — avoids a build step
  // during dev and keeps types live.
  transpilePackages: ["@gtm/shared", "@gtm/database"],
  // Pin the file-tracing root to this monorepo — there's an unrelated
  // package-lock.json in the parent folder that Next would otherwise infer as
  // the workspace root.
  outputFileTracingRoot: resolve(__dirname, "../../"),
  // Reasonable images allowlist for Google profile pics from NextAuth.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
