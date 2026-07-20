import IORedis from "ioredis";
import { env } from "../env";

// Shared by every BullMQ Queue/Worker in this app (image-jobs, brain-jobs,
// ...) — one Redis connection, not one per queue. BullMQ requires
// `maxRetriesPerRequest: null` on any connection it manages (its own
// blocking commands don't play well with ioredis's default retry limit).
export const redisConnection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
