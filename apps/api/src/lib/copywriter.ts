import { db, schema } from "@canvas/db";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";

type CopyVariant = (typeof schema.copyGenerations.$inferSelect)["approvedJson"][number];

// Pulls the brand kit's most recently approved copy to use as few-shot
// voice examples — the brand-voice flywheel from trekuartista-copy's
// fetchApprovedExamples, ported to Drizzle.
export async function fetchApprovedExamples(brandKitId: string, limit = 8): Promise<string[]> {
  const rows = await db.query.copyGenerations.findMany({
    where: and(
      eq(schema.copyGenerations.brandKitId, brandKitId),
      isNull(schema.copyGenerations.deletedAt),
      gt(sql`jsonb_array_length(${schema.copyGenerations.approvedJson})`, 0),
    ),
    orderBy: desc(schema.copyGenerations.createdAt),
    limit: 15,
    columns: { approvedJson: true },
  });

  const examples: string[] = [];
  for (const row of rows) {
    for (const v of row.approvedJson as CopyVariant[]) {
      const t = v?.text || [v?.design_copy, v?.caption].filter(Boolean).join(" — ");
      if (t && !examples.includes(t)) examples.push(t);
      if (examples.length >= limit) return examples;
    }
  }
  return examples;
}
