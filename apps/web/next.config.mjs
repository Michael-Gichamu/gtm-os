/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pull source straight from the workspace packages — avoids a build step
  // during dev and keeps types live.
  transpilePackages: ["@gtm/shared", "@gtm/database"],
  experimental: {
    typedRoutes: false,
  },
  // Reasonable images allowlist for Google profile pics from NextAuth.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
