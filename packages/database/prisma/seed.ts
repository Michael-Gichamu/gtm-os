/**
 * Seed script — establishes a baseline workspace so a fresh dev environment
 * is immediately usable. Runs the default pipeline stages every time
 * (idempotent on (workspaceId, name)).
 *
 * Sample leads are gated behind SEED_SAMPLE_DATA=1 so production-style runs
 * stay clean.
 */
import { PrismaClient, StageSemantic } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_STAGES: Array<{
  name: string;
  position: number;
  semantic: StageSemantic;
  color: string;
}> = [
  { name: "New Lead",      position: 0, semantic: StageSemantic.OPEN, color: "#94a3b8" },
  { name: "Contacted",     position: 1, semantic: StageSemantic.OPEN, color: "#60a5fa" },
  { name: "Opened",        position: 2, semantic: StageSemantic.OPEN, color: "#38bdf8" },
  { name: "Replied",       position: 3, semantic: StageSemantic.OPEN, color: "#22d3ee" },
  { name: "Interested",    position: 4, semantic: StageSemantic.OPEN, color: "#a78bfa" },
  { name: "Discovery",     position: 5, semantic: StageSemantic.OPEN, color: "#f472b6" },
  { name: "Proposal Sent", position: 6, semantic: StageSemantic.OPEN, color: "#fb923c" },
  { name: "Won",           position: 7, semantic: StageSemantic.WON,  color: "#22c55e" },
  { name: "Lost",          position: 8, semantic: StageSemantic.LOST, color: "#ef4444" },
];

async function main() {
  const workspace = await prisma.workspace.upsert({
    where: { slug: "default" },
    update: {},
    create: { slug: "default", name: "Default Workspace" },
  });

  for (const stage of DEFAULT_STAGES) {
    await prisma.pipelineStage.upsert({
      where: {
        workspaceId_name: { workspaceId: workspace.id, name: stage.name },
      },
      update: { position: stage.position, semantic: stage.semantic, color: stage.color },
      create: { ...stage, workspaceId: workspace.id },
    });
  }

  if (process.env.SEED_SAMPLE_DATA === "1") {
    const newLeadStage = await prisma.pipelineStage.findFirstOrThrow({
      where: { workspaceId: workspace.id, name: "New Lead" },
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
        where: {
          workspaceId_email: { workspaceId: workspace.id, email: s.email! },
        },
        update: {},
        create: {
          ...s,
          workspaceId: workspace.id,
          pipelineStageId: newLeadStage.id,
          source: "seed",
        },
      });
    }
  }

  console.log(`Seed complete. Workspace=${workspace.slug} stages=${DEFAULT_STAGES.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
