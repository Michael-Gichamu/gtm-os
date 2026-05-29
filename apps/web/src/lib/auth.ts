import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma, WorkspaceRole } from "@gtm/database";
import { serverEnv } from "./env";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      workspaceId: string;
      workspaceRole: WorkspaceRole;
    } & DefaultSession["user"];
  }
}

/**
 * Auth.js v5 configuration.
 *
 * Notes:
 *   - We use the JWT session strategy so the session payload (including the
 *     workspaceId) is available in edge contexts without a DB round-trip.
 *   - PrismaAdapter keeps user/account rows in sync with the database; we
 *     attach the workspace membership in the `jwt` callback after the
 *     initial sign-in.
 *   - On first sign-in, every user gets a personal workspace as OWNER. Phase
 *     1 ships single-user workspaces; team invites land in a later phase.
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  secret: serverEnv.NEXTAUTH_SECRET,
  providers: [
    Google({
      clientId: serverEnv.GOOGLE_CLIENT_ID,
      clientSecret: serverEnv.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // `user` is only populated on first sign-in.
      const userId = (user?.id as string | undefined) ?? (token.sub as string | undefined);
      if (!userId) return token;

      // Ensure the user has a workspace + membership.
      let membership = await prisma.workspaceMember.findFirst({
        where: { userId },
        include: { workspace: true },
      });

      if (!membership) {
        const dbUser = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
        const slugBase = (dbUser.email.split("@")[0] || "ws").toLowerCase().replace(/[^a-z0-9]/g, "-");
        const slug = `${slugBase}-${userId.slice(0, 6)}`;
        const workspace = await prisma.workspace.create({
          data: { name: `${dbUser.name ?? dbUser.email}'s Workspace`, slug },
        });
        membership = await prisma.workspaceMember.create({
          data: { workspaceId: workspace.id, userId, role: WorkspaceRole.OWNER },
          include: { workspace: true },
        });
        // Seed default pipeline stages for new workspaces. Mirrors the
        // canonical stages in packages/database/prisma/seed.ts — must stay in
        // sync. Stages model relationship progression (sales funnel), not
        // email engagement events (those live in the Activity log).
        const stages = [
          { name: "New Lead",      position: 0, semantic: "OPEN" as const, color: "#94a3b8" },
          { name: "Qualified",     position: 1, semantic: "OPEN" as const, color: "#60a5fa" },
          { name: "Contacted",     position: 2, semantic: "OPEN" as const, color: "#38bdf8" },
          { name: "Engaged",       position: 3, semantic: "OPEN" as const, color: "#22d3ee" },
          { name: "Discovery",     position: 4, semantic: "OPEN" as const, color: "#a78bfa" },
          { name: "Proposal Sent", position: 5, semantic: "OPEN" as const, color: "#f472b6" },
          { name: "Negotiation",   position: 6, semantic: "OPEN" as const, color: "#fb923c" },
          { name: "Won",           position: 7, semantic: "WON" as const,  color: "#22c55e" },
          { name: "Lost",          position: 8, semantic: "LOST" as const, color: "#ef4444" },
        ];
        await prisma.pipelineStage.createMany({
          data: stages.map((s) => ({ ...s, workspaceId: workspace.id })),
          skipDuplicates: true,
        });
      }

      token.uid = userId;
      token.wsid = membership.workspaceId;
      token.wsrole = membership.role;
      return token;
    },
    async session({ session, token }) {
      session.user.id = (token.uid as string) ?? session.user.id;
      session.user.workspaceId = token.wsid as string;
      session.user.workspaceRole = token.wsrole as WorkspaceRole;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
