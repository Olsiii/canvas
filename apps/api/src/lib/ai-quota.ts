import { db, schema } from "@canvas/db";
import {
  AI_BRAIN_MESSAGES_PER_DAY,
  AI_COST_USD_PER_MONTH_TOTAL,
  AI_IMAGE_GENERATIONS_PER_DAY,
} from "@canvas/shared";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { redisConnection } from "../queues/connection";
import { checkRateLimit, rateLimitBucketKey } from "./rate-limit";

export type AiQuotaKind = "brain" | "generate";

export class AiQuotaError extends Error {
  readonly code = "TOO_MANY_REQUESTS" as const;
  constructor(message: string) {
    super(message);
    this.name = "AiQuotaError";
  }
}

// Epoch is a UTC midnight, so floor(now / DAY_MS) buckets land exactly on
// UTC calendar-day boundaries — the same fixed-window trick checkRateLimit
// already uses for its minute/second windows, just with a day-sized window.
const DAY_MS = 24 * 60 * 60 * 1000;

function startOfUtcMonth(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

// The $ cap is a single app-wide total (see AI_COST_USD_PER_MONTH_TOTAL's
// doc comment) — summed with no userId/workspaceId filter at all, unlike
// the two daily counters below which stay per-user.
async function getAppWideMonthlySpendUsd(): Promise<number> {
  const monthStart = startOfUtcMonth();
  const [row] = await db
    .select({
      total: sql<string>`coalesce(sum(${schema.aiUsage.costUsdEst}::numeric), 0)`,
    })
    .from(schema.aiUsage)
    .where(gte(schema.aiUsage.createdAt, monthStart));
  return parseFloat(row?.total ?? "0");
}

/**
 * AI budgets (defaults in @canvas/shared ai-quotas):
 * - 50 Brain messages / UTC day, per user
 * - 20 image generate+edit requests / UTC day, per user
 * - $50 estimated cost / UTC calendar month, shared app-wide (every user,
 *   every workspace) — not per-user. The per-user daily counters above
 *   still apply on top of it, so no single user can exhaust the whole
 *   shared budget in one day.
 *
 * Daily counters live in Redis (request-time, via the shared checkRateLimit
 * fixed-window limiter). Monthly $ uses summed ai_usage.
 */
export async function assertAiQuota(userId: string, kind: AiQuotaKind) {
  if (kind === "brain") {
    const { overLimit } = await checkRateLimit(`aiquota:brain:${userId}`, {
      max: AI_BRAIN_MESSAGES_PER_DAY,
      windowMs: DAY_MS,
    });
    if (overLimit) {
      throw new AiQuotaError(
        `Daily Brain limit reached (${AI_BRAIN_MESSAGES_PER_DAY} messages). Try again tomorrow.`,
      );
    }
  } else {
    const { overLimit } = await checkRateLimit(`aiquota:generate:${userId}`, {
      max: AI_IMAGE_GENERATIONS_PER_DAY,
      windowMs: DAY_MS,
    });
    if (overLimit) {
      throw new AiQuotaError(
        `Daily image generation limit reached (${AI_IMAGE_GENERATIONS_PER_DAY}). Try again tomorrow.`,
      );
    }
  }

  const spent = await getAppWideMonthlySpendUsd();
  if (spent >= AI_COST_USD_PER_MONTH_TOTAL) {
    throw new AiQuotaError(
      `Canvas-wide monthly AI budget reached (≈$${AI_COST_USD_PER_MONTH_TOTAL}). Contact an admin if you need more.`,
    );
  }
}

export async function getAiQuotaSnapshot(userId: string) {
  const now = new Date();
  const brainUsed = Number(
    (await redisConnection.get(rateLimitBucketKey(`aiquota:brain:${userId}`, now, DAY_MS))) ?? 0,
  );
  const generateUsed = Number(
    (await redisConnection.get(rateLimitBucketKey(`aiquota:generate:${userId}`, now, DAY_MS))) ?? 0,
  );

  const spentUsd = await getAppWideMonthlySpendUsd();

  // Also surface today's completed generate/edit rows for the admin view —
  // this one stays scoped to the requesting admin's own usage, distinct
  // from the app-wide $ total above.
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const [genRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.aiUsage)
    .where(
      and(
        eq(schema.aiUsage.userId, userId),
        gte(schema.aiUsage.createdAt, dayStart),
        inArray(schema.aiUsage.kind, ["generate", "edit"]),
      ),
    );

  return {
    brainMessagesPerDay: AI_BRAIN_MESSAGES_PER_DAY,
    brainMessagesUsedToday: brainUsed,
    imageGenerationsPerDay: AI_IMAGE_GENERATIONS_PER_DAY,
    imageGenerationsUsedToday: generateUsed,
    imageGenerationsCompletedToday: genRow?.count ?? 0,
    costUsdPerMonth: AI_COST_USD_PER_MONTH_TOTAL,
    costUsdSpentThisMonth: spentUsd,
  };
}
