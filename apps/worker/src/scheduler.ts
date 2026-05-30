import { prisma } from "@gtm/database";
import { enrollmentQueue } from "./queues.js";
import { logger } from "./logger.js";

/**
 * Scheduling loop. Runs every minute:
 *
 *   SELECT enrollments where status IN (ENROLLED, ACTIVE)
 *                       AND campaign.status = ACTIVE
 *                       AND nextSendAt <= now()
 *
 * For each row, enqueues an "advance" job keyed on the enrollment id (so the
 * same enrollment can't have two advance jobs in flight at once — BullMQ
 * dedupes by jobId).
 *
 * Each scheduling tick caps the number of jobs queued per campaign by its
 * dailyCap minus the count of EMAIL_SENT activities for that campaign in the
 * last 24 hours — a coarse but effective rate limit during Phase 2's stub
 * sends. Phase 3 will move this to per-mailbox limits once Gmail is wired.
 */

const TICK_MS = 60_000;

interface ScheduleStats {
  scanned: number;
  queued: number;
  cappedCampaigns: number;
}

async function tick(): Promise<ScheduleStats> {
  const now = new Date();
  const stats: ScheduleStats = { scanned: 0, queued: 0, cappedCampaigns: 0 };

  // Look at most ~500 due enrollments per tick to avoid huge bursts.
  const due = await prisma.campaignEnrollment.findMany({
    where: {
      status: { in: ["ENROLLED", "ACTIVE"] },
      nextSendAt: { lte: now },
      campaign: { status: "ACTIVE" },
    },
    select: { id: true, campaignId: true },
    take: 500,
    orderBy: { nextSendAt: "asc" },
  });
  stats.scanned = due.length;
  if (due.length === 0) return stats;

  // Group by campaign so we can apply the per-campaign dailyCap.
  const byCampaign = new Map<string, string[]>();
  for (const e of due) {
    const list = byCampaign.get(e.campaignId) ?? [];
    list.push(e.id);
    byCampaign.set(e.campaignId, list);
  }

  // Fetch caps + already-sent counts in the last 24h for each campaign.
  // We count EMAIL_SENT activities filtered by payload.campaignId rather than
  // a dedicated SendRecord table — Phase 3 may move this to a typed table
  // when real sends carry Gmail message IDs we need to index. For now, one
  // count per campaign is cheap (n is small, typically <20 active campaigns).
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const campaignIds = Array.from(byCampaign.keys());
  const campaigns = await prisma.campaign.findMany({
    where: { id: { in: campaignIds } },
    select: { id: true, dailyCap: true },
  });
  const sentCounts = new Map<string, number>();
  for (const c of campaigns) {
    const count = await prisma.activity.count({
      where: {
        type: "EMAIL_SENT",
        createdAt: { gte: dayAgo },
        payload: { path: ["campaignId"], equals: c.id },
      },
    });
    sentCounts.set(c.id, count);
  }

  for (const c of campaigns) {
    const ids = byCampaign.get(c.id) ?? [];
    const sentToday = sentCounts.get(c.id) ?? 0;
    const remaining = Math.max(0, c.dailyCap - sentToday);
    if (remaining <= 0) {
      stats.cappedCampaigns++;
      continue;
    }
    const toQueue = ids.slice(0, remaining);
    for (const enrollmentId of toQueue) {
      await enrollmentQueue.add(
        "advance",
        { enrollmentId },
        {
          // jobId guarantees we never have two advance jobs for the same
          // enrollment in flight — second add is a no-op.
          jobId: `adv:${enrollmentId}`,
        },
      );
      stats.queued++;
    }
  }

  return stats;
}

export function startScheduler(): NodeJS.Timeout {
  // Fire immediately on boot then every TICK_MS.
  const run = () => {
    tick()
      .then((s) => {
        if (s.scanned > 0 || s.queued > 0) {
          logger.info(s, "scheduler tick");
        } else {
          logger.debug(s, "scheduler tick (idle)");
        }
      })
      .catch((err) => logger.error({ err }, "scheduler tick failed"));
  };
  run();
  return setInterval(run, TICK_MS);
}
