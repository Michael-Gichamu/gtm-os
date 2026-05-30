import "./env.js";
import { Worker, redis, enrollmentQueue, QUEUE_NAME, type AdvanceJobData } from "./queues.js";
import { advanceEnrollment } from "./advance.js";
import { startScheduler } from "./scheduler.js";
import { logger } from "./logger.js";

// --- BullMQ worker: drains the queue and runs the advance pipeline. -----
const bullWorker = new Worker<AdvanceJobData>(
  QUEUE_NAME,
  async (job) => {
    const { enrollmentId } = job.data;
    logger.debug({ jobId: job.id, enrollmentId }, "advance: start");
    await advanceEnrollment(enrollmentId);
    logger.debug({ jobId: job.id, enrollmentId }, "advance: done");
  },
  {
    connection: redis,
    concurrency: 8,
  },
);

bullWorker.on("failed", (job, err) => {
  logger.error(
    { jobId: job?.id, attempts: job?.attemptsMade, err: err.message },
    "advance: failed",
  );
});
bullWorker.on("error", (err) => {
  logger.error({ err }, "worker connection error");
});

// --- Periodic scheduler: queues advance jobs for due enrollments. -------
const tick = startScheduler();

logger.info(
  { queue: QUEUE_NAME, concurrency: 8 },
  "gtm-worker started — scheduler + advance pipeline online",
);

// --- Graceful shutdown ---
async function shutdown(signal: string) {
  logger.info({ signal }, "worker shutting down");
  clearInterval(tick);
  await bullWorker.close();
  await enrollmentQueue.close();
  await redis.quit();
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
