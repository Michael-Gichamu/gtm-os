import { prisma, Prisma, EnrollmentStatus, ActivityType } from "@gtm/database";
import type {
  CampaignEnrollmentDto,
  EnrollLeadsInput,
  EnrollLeadsResult,
} from "@gtm/shared";
import { NotFound, BadRequest } from "../errors.js";

type EnrollmentRow = Prisma.CampaignEnrollmentGetPayload<{
  include: {
    campaign: { select: { name: true } };
    lead: { select: { companyName: true; contactName: true; email: true } };
  };
}>;

function toDto(e: EnrollmentRow): CampaignEnrollmentDto {
  return {
    id: e.id,
    workspaceId: e.workspaceId,
    campaignId: e.campaignId,
    campaignName: e.campaign.name,
    leadId: e.leadId,
    leadCompanyName: e.lead.companyName,
    leadContactName: e.lead.contactName,
    leadEmail: e.lead.email,
    currentStep: e.currentStep,
    nextSendAt: e.nextSendAt?.toISOString() ?? null,
    status: e.status,
    enrolledAt: e.enrolledAt.toISOString(),
    lastSentAt: e.lastSentAt?.toISOString() ?? null,
    completedAt: e.completedAt?.toISOString() ?? null,
    pausedAt: e.pausedAt?.toISOString() ?? null,
  };
}

const include = {
  campaign: { select: { name: true } },
  lead: { select: { companyName: true, contactName: true, email: true } },
} satisfies Prisma.CampaignEnrollmentInclude;

export const EnrollmentService = {
  /**
   * Enroll a batch of leads into a campaign.
   *
   * Idempotent: skips any (campaignId, leadId) that's already enrolled — the
   * UI is allowed to fire-and-forget. Schedules every newly-enrolled row with
   * nextSendAt=now so the worker's next scheduling pass picks them up. The
   * actual first-step send respects the campaign's send window + jitter and
   * is decided by the worker, not here.
   */
  async enrollLeads(
    workspaceId: string,
    actorUserId: string,
    campaignId: string,
    input: EnrollLeadsInput,
  ): Promise<EnrollLeadsResult> {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, workspaceId },
      include: { _count: { select: { steps: true } } },
    });
    if (!campaign) throw NotFound("Campaign");
    if (campaign.status === "ARCHIVED") {
      throw BadRequest("Cannot enroll into an archived campaign.");
    }
    if (campaign._count.steps === 0) {
      throw BadRequest("Add at least one sequence step before enrolling leads.");
    }

    // One query for existing enrollments → O(1) dedupe per lead.
    const existing = await prisma.campaignEnrollment.findMany({
      where: { campaignId, leadId: { in: input.leadIds } },
      select: { leadId: true },
    });
    const enrolledSet = new Set(existing.map((e) => e.leadId));

    // And one for valid workspace leads so we can flag stale IDs.
    const ownedLeads = await prisma.lead.findMany({
      where: { id: { in: input.leadIds }, workspaceId },
      select: { id: true },
    });
    const ownedSet = new Set(ownedLeads.map((l) => l.id));

    const result: EnrollLeadsResult = { enrolled: 0, skipped: 0, errors: [] };
    const now = new Date();

    for (const leadId of input.leadIds) {
      if (!ownedSet.has(leadId)) {
        result.errors.push({ leadId, error: "Lead not found in workspace" });
        continue;
      }
      if (enrolledSet.has(leadId)) {
        result.skipped++;
        continue;
      }
      try {
        await prisma.$transaction(async (tx) => {
          await tx.campaignEnrollment.create({
            data: {
              workspaceId,
              campaignId,
              leadId,
              status: EnrollmentStatus.ENROLLED,
              nextSendAt: now, // worker may delay further based on send window
            },
          });
          await tx.activity.create({
            data: {
              workspaceId,
              leadId,
              actorUserId,
              type: ActivityType.LEAD_ENROLLED,
              payload: { campaignId, campaignName: campaign.name },
            },
          });
        });
        result.enrolled++;
      } catch (e) {
        result.errors.push({
          leadId,
          error: e instanceof Error ? e.message : "Unknown error",
        });
      }
    }

    return result;
  },

  async listForCampaign(
    workspaceId: string,
    campaignId: string,
  ): Promise<CampaignEnrollmentDto[]> {
    const rows = await prisma.campaignEnrollment.findMany({
      where: { workspaceId, campaignId },
      include,
      orderBy: { enrolledAt: "desc" },
      take: 500,
    });
    return rows.map(toDto);
  },

  async listForLead(
    workspaceId: string,
    leadId: string,
  ): Promise<CampaignEnrollmentDto[]> {
    const rows = await prisma.campaignEnrollment.findMany({
      where: { workspaceId, leadId },
      include,
      orderBy: { enrolledAt: "desc" },
    });
    return rows.map(toDto);
  },

  async setStatus(
    workspaceId: string,
    enrollmentId: string,
    status: "PAUSED" | "ACTIVE" | "STOPPED_MANUAL",
  ): Promise<CampaignEnrollmentDto> {
    const existing = await prisma.campaignEnrollment.findFirst({
      where: { id: enrollmentId, workspaceId },
    });
    if (!existing) throw NotFound("Enrollment");
    if (existing.status === "COMPLETED" || existing.status === "BOUNCED") {
      throw BadRequest("Enrollment is already in a terminal state.");
    }
    const data: Prisma.CampaignEnrollmentUpdateInput = { status };
    if (status === "PAUSED") data.pausedAt = new Date();
    if (status === "ACTIVE") data.pausedAt = null;
    const updated = await prisma.campaignEnrollment.update({
      where: { id: enrollmentId },
      data,
      include,
    });
    return toDto(updated);
  },
};
