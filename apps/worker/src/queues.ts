import { Queue, QueueEvents, Worker } from "bullmq";
import { Redis } from "ioredis";
import { env } from "./env.js";

/**
 * Shared Redis connection for BullMQ. `maxRetriesPerRequest: null` is the
 * BullMQ-required setting so blocking operations (BRPOPLPUSH etc.) don't time
 * out under normal load.
 */
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

export const QUEUE_NAME = "gtm:enrollments";

/** Job: advance a single enrollment (send current step or finalize). */
export interface AdvanceJobData {
  enrollmentId: string;
}

export const enrollmentQueue = new Queue<AdvanceJobData>(QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5_000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 1000 },
  },
});

export const enrollmentQueueEvents = new QueueEvents(QUEUE_NAME, {
  connection: redis,
});

export { Worker };
