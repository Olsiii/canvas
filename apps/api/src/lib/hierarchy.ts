import { db, schema } from "@canvas/db";
import { TRPCError } from "@trpc/server";
import { and, eq, isNull } from "drizzle-orm";

export async function requireSpace(spaceId: string) {
  const space = await db.query.spaces.findFirst({
    where: and(eq(schema.spaces.id, spaceId), isNull(schema.spaces.deletedAt)),
  });
  if (!space) throw new TRPCError({ code: "NOT_FOUND" });
  return space;
}

export async function requireList(listId: string) {
  const list = await db.query.lists.findFirst({
    where: and(eq(schema.lists.id, listId), isNull(schema.lists.deletedAt)),
  });
  if (!list) throw new TRPCError({ code: "NOT_FOUND" });
  return list;
}
