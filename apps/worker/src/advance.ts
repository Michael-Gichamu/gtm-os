import { prisma, ActivityType, EnrollmentStatus } from "@gtm/database";
import { renderTemplate } from "@gtm/shared";
import { logger } from "./logger.js";
import { scheduleSendAt } from "./schedule.js";

/**
 * Advance one enrollment by one step.
 *
 * Pipeline:
 *   1. Load enrollment + campaign + lead + current SequenceStep.
 *   2. Skip if status isn't ENROLLED/ACTIVE, or campaign is not ACTIVE, or
 *      no current step exists (sequence shortened underneath us).
 *   3. Render subject + body against the lead.
 *   4. STUBBED send — Phase 2 only logs; Phase 3 substitutes a Gmail call.
 *   5. Write EMAIL_SENT activity (payload.stubbed=true for Phase 2).
 *   6. Look up the NEXT step:
 *        - none -> mark COMPLETED, write CAMPAIGN_COMPLETED activity.
 *        - exists -> set currentStep++, nextSendAt = scheduleSendAt(
 *            lastSentAt + delayDays, campaign window).
 *
 * The whole mutation block is one transaction so a partial failure either
 * sends + advances, or does neither.
 */
export async function advanceEnrollment(enrollmentId: string): Promise<void> {
  const enrollment = await prisma.campaignEnrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      campaign: { select: { id: true, name: true, status: true, sendWindowStart: true, sendWindowEnd: true, jitterMinutes: true } },
      lead: {
        select: {
          id: true,
          companyName: true,
          contactName: true,
          email: true,
          industry: true,
          personalization: true,
          city: true,
          country: true,
          role: true,
        },
      },
    },
  });
  if (!enrollment) {
    logger.warn({ enrollmentId }, "advance: enrollment vanished");
    return;
  }

  if (enrollment.campaign.status !== "ACTIVE") {
    logger.debug({ enrollmentId, campaignStatus: enrollment.campaign.status }, "advance: campaign not active, skip");
    return;
  }
  if (
    enrollment.status !== EnrollmentStatus.ENROLLED &&
    enrollment.status !== EnrollmentStatus.ACTIVE
  ) {
    logger.debug({ enrollmentId, status: enrollment.status }, "advance: enrollment not eligible, skip");
    return;
  }

  // Find the current step (by order = currentStep) and the next step.
  const [currentStep, nextStep] = await Promise.all([
    prisma.sequenceStep.findUnique({
      where: { campaignId_order: { campaignId: enrollment.campaignId, order: enrollment.currentStep } },
    }),
    prisma.sequenceStep.findUnique({
      where: { campaignId_order: { campaignId: enrollment.campaignId, order: enrollment.currentStep + 1 } },
    }),
  ]);

  if (!currentStep) {
    // Sequence was shortened to fewer steps than we're pointing at — nothing
    // sensible to send. Mark completed so we stop spinning on this row.
    logger.warn(
      { enrollmentId, currentStep: enrollment.currentStep },
      "advance: current step missing, marking completed",
    );
    await prisma.campaignEnrollment.update({
      where: { id: enrollmentId },
      data: {
        status: EnrollmentStatus.COMPLETED,
        completedAt: new Date(),
        nextSendAt: null,
      },
    });
    return;
  }

  const rendered = {
    subject: renderTemplate(currentStep.subject, enrollment.lead, { fallback: "" }),
    body: renderTemplate(currentStep.body, enrollment.lead, { fallback: "" }),
  };

  // -------------------------------------------------------------
  // PHASE 2: stubbed send. Phase 3 replaces this with a Gmail call.
  // -------------------------------------------------------------
  logger.info(
    {
      enrollmentId,
      to: enrollment.lead.email ?? "(no email)",
      campaign: enrollment.campaign.name,
      step: enrollment.currentStep,
      subject: rendered.subject,
      stubbed: true,
    },
    "[SEND-STUB] would deliver email",
  );

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.activity.create({
      data: {
        workspaceId: enrollment.workspaceId,
        leadId: enrollment.leadId,
        actorUserId: null,
        type: ActivityType.EMAIL_SENT,
        payload: {
          campaignId: enrollment.campaignId,
          enrollmentId: enrollment.id,
          step: enrollment.currentStep,
          subject: rendered.subject,
          stubbed: true,
        },
      },
    });

    if (!nextStep) {
      // Last step — mark COMPLETED and write a campaign-level activity.
      await tx.campaignEnrollment.update({
        where: { id: enrollment.id },
        data: {
          status: EnrollmentStatus.COMPLETED,
          completedAt: now,
          lastSentAt: now,
          currentStep: enrollment.currentStep + 1,
          nextSendAt: null,
        },
      });
      await tx.activity.create({
        data: {
          workspaceId: enrollment.workspaceId,
          leadId: enrollment.leadId,
          type: ActivityType.CAMPAIGN_COMPLETED,
          payload: { campaignId: enrollment.campaignId },
        },
      });
    } else {
      const earliest = new Date(now.getTime() + nextStep.delayDays * 24 * 60 * 60 * 1000);
      const nextSendAt = scheduleSendAt(earliest, enrollment.campaign, now);
      await tx.campaignEnrollment.update({
        where: { id: enrollment.id },
        data: {
          status: EnrollmentStatus.ACTIVE,
          currentStep: enrollment.currentStep + 1,
          lastSentAt: now,
          nextSendAt,
        },
      });
    }
  });
}
