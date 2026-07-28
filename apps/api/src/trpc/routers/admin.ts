import { db } from "@canvas/db";
import { workspaceAdminSchema } from "@canvas/shared";
import { sql } from "drizzle-orm";
import { getAiQuotaSnapshot } from "../../lib/ai-quota";
import { assertCan } from "../../lib/permissions";
import { redisConnection } from "../../queues/connection";
import { protectedProcedure, router } from "../trpc";

async function probeHealth(): Promise<{
  ok: boolean;
  checks: Record<string, "ok" | "error">;
}> {
  const checks: Record<string, "ok" | "error"> = { api: "ok" };
  try {
    await db.execute(sql`select 1`);
    checks.database = "ok";
  } catch {
    checks.database = "error";
  }
  try {
    const pong = await redisConnection.ping();
    checks.redis = pong === "PONG" ? "ok" : "error";
  } catch {
    checks.redis = "error";
  }
  return { ok: Object.values(checks).every((v) => v === "ok"), checks };
}

export const adminRouter = router({
  // Same probes as GET /health, but gated so only workspace admins see them
  // in the Admin UI (the public /health route stays for load balancers).
  status: protectedProcedure.input(workspaceAdminSchema).query(async ({ ctx, input }) => {
    await assertCan(ctx.user, input.workspaceId, "workspace:manage");
    return probeHealth();
  }),

  myAiQuota: protectedProcedure.input(workspaceAdminSchema).query(async ({ ctx, input }) => {
    // Admin page only — same owner/admin gate as status/backups/audit.
    await assertCan(ctx.user, input.workspaceId, "workspace:manage");
    return getAiQuotaSnapshot(ctx.user.id);
  }),

  backupGuidance: protectedProcedure.input(workspaceAdminSchema).query(async ({ ctx, input }) => {
    await assertCan(ctx.user, input.workspaceId, "workspace:manage");
    return {
      hosting: "vps_compose" as const,
      steps: [
        "Run API, worker, and web behind Docker Compose on your VPS (see repo Dockerfile).",
        "Nightly: pg_dump $DATABASE_URL | gzip > backup-$(date -u +%Y%m%d).sql.gz",
        "Copy dumps to off-box storage (S3/R2 or another disk). Keep at least 7 daily + 4 weekly.",
        "Also version object storage (image/files bucket) or sync it with rclone.",
        "Quarterly restore drill: load a dump into a scratch Postgres and hit /health.",
      ],
      restoreHint:
        "gunzip -c backup.sql.gz | psql $DATABASE_URL — then pnpm db:migrate if the dump is from an older schema.",
    };
  }),
});
