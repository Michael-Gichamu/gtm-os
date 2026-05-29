/**
 * Seed script — establishes baseline pipeline stages and (optionally) sample
 * leads. Idempotent: safe to re-run any time. Applies to ALL existing
 * workspaces, so re-running after a stage redesign updates user workspaces
 * too (renames, repositions, merges legacy stages into their new equivalents).
 *
 * Stage philosophy (the v2 redesign):
 *   The pipeline tracks RELATIONSHIP PROGRESSION (the sales funnel) — not
 *   email engagement events (those live in the Activity log and Phase 5
 *   campaign analytics). So "Opened" and "Replied" are gone as stages and
 *   merged into the closer sales-relevant equivalents.
 *
 * Sample leads are gated behind SEED_SAMPLE_DATA=1.
 */
import { PrismaClient, StageSemantic } from "@prisma/client";

const prisma = new PrismaClient();

// Canonical sales pipeline. Order matters — `position` follows the array.
const STAGES: Array<{
  name: string;
  semantic: StageSemantic;
  color: string;
}> = [
  { name: "New Lead",      semantic: StageSemantic.OPEN, color: "#94a3b8" }, // raw, unworked
  { name: "Qualified",     semantic: StageSemantic.OPEN, color: "#60a5fa" }, // ICP fit confirmed, ready to contact
  { name: "Contacted",     semantic: StageSemantic.OPEN, color: "#38bdf8" }, // first touch sent
  { name: "Engaged",       semantic: StageSemantic.OPEN, color: "#22d3ee" }, // replied / positive signal
  { name: "Discovery",     semantic: StageSemantic.OPEN, color: "#a78bfa" }, // discovery call booked/done
  { name: "Proposal Sent", semantic: StageSemantic.OPEN, color: "#f472b6" }, // proposal / quote out
  { name: "Negotiation",   semantic: StageSemantic.OPEN, color: "#fb923c" }, // terms / pricing back-and-forth
  { name: "Won",           semantic: StageSemantic.WON,  color: "#22c55e" }, // closed-won → becomes a Client
  { name: "Lost",          semantic: StageSemantic.LOST, color: "#ef4444" }, // closed-lost
];

// Legacy stage names that no longer exist — map them to their nearest new
// equivalent so existing leads aren't orphaned. Applied per workspace.
const LEGACY_MIGRATION: Record<string, string> = {
  "Opened": "Contacted",     // email-open isn't a relationship stage
  "Replied": "Engaged",      // renamed
  "Interested": "Engaged",   // merged
};

async function migrateWorkspaceStages(workspaceId: string) {
  // 1. Upsert all canonical stages with correct position/semantic/color.
  for (let i = 0; i < STAGES.length; i++) {
    const s = STAGES[i]!;
    await prisma.pipelineStage.upsert({
      where: { workspaceId_name: { workspaceId, name: s.name } },
      update: { position: i, semantic: s.semantic, color: s.color },
      create: { workspaceId, name: s.name, position: i, semantic: s.semantic, color: s.color },
    });
  }

  // 2. For each legacy stage still present in this workspace, move its leads
  //    to the mapped target then delete the legacy row. Stage delete is safe
  //    only after we've moved every lead off it (the schema sets
  //    pipelineStageId to null on stage delete, which we DON'T want).
  for (const [legacy, target] of Object.entries(LEGACY_MIGRATION)) {
    const legacyStage = await prisma.pipelineStage.findUnique({
      where: { workspaceId_name: { workspaceId, name: legacy } },
    });
    if (!legacyStage) continue;
    const targetStage = await prisma.pipelineStage.findUniqueOrThrow({
      where: { workspaceId_name: { workspaceId, name: target } },
    });
    await prisma.lead.updateMany({
      where: { workspaceId, pipelineStageId: legacyStage.id },
      data: { pipelineStageId: targetStage.id },
    });
    await prisma.pipelineStage.delete({ where: { id: legacyStage.id } });
  }
}

async function main() {
  // Make sure a default workspace exists so a fresh dev DB is usable.
  const defaultWorkspace = await prisma.workspace.upsert({
    where: { slug: "default" },
    update: {},
    create: { slug: "default", name: "Default Workspace" },
  });

  // Apply the canonical stages + legacy migration to EVERY workspace.
  // (Existing user workspaces created during sign-in get the redesign too.)
  const workspaces = await prisma.workspace.findMany({ select: { id: true, slug: true } });
  for (const ws of workspaces) {
    await migrateWorkspaceStages(ws.id);
  }

  if (process.env.SEED_SAMPLE_DATA === "1") {
    const newLeadStage = await prisma.pipelineStage.findFirstOrThrow({
      where: { workspaceId: defaultWorkspace.id, name: "New Lead" },
    });
    const samples = [
      {
        companyName: "Sunrise Dental Clinic",
        industry: "Dental",
        website: "https://sunrisedental.example",
        country: "Kenya",
        city: "Nairobi",
        contactName: "Dr. Amina Okoth",
        role: "Founder",
        email: "amina@sunrisedental.example",
        confidenceScore: 86,
      },
      {
        companyName: "Westlands Auto Garage",
        industry: "Automotive",
        website: "https://westlandsauto.example",
        country: "Kenya",
        city: "Nairobi",
        contactName: "Brian Mwangi",
        role: "Director",
        email: "brian@westlandsauto.example",
        confidenceScore: 71,
      },
      {
        companyName: "Karen Diagnostic Lab",
        industry: "Diagnostics",
        website: "https://karendiag.example",
        country: "Kenya",
        city: "Nairobi",
        contactName: null,
        role: null,
        email: "info@karendiag.example",
        confidenceScore: 42,
      },
    ];
    for (const s of samples) {
      await prisma.lead.upsert({
        where: { workspaceId_email: { workspaceId: defaultWorkspace.id, email: s.email! } },
        update: {},
        create: { ...s, workspaceId: defaultWorkspace.id, pipelineStageId: newLeadStage.id, source: "seed" },
      });
    }
  }

  console.log(
    `Seed complete. workspaces=${workspaces.length} stages=${STAGES.length} per workspace`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
