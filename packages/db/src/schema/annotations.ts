import { doublePrecision, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";
import { comments } from "./comments";
import { imageVersions } from "./image-brain";

// DATA_MODEL.md: annotations (id, image_version_id fk, comment_id fk, x pct,
// y pct, w pct null, h pct null). M4.4 only ever creates point pins (w/h
// stay null) — box/region annotations are schema-ready but no UI draws them
// yet. Percentages (not pixels) so a pin's position is resolution-independent
// and the same annotation row still lines up if the served image size ever
// changes.
export const annotations = pgTable("annotations", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  imageVersionId: uuid("image_version_id")
    .notNull()
    .references(() => imageVersions.id, { onDelete: "cascade" }),
  commentId: uuid("comment_id")
    .notNull()
    .references(() => comments.id, { onDelete: "cascade" }),
  x: doublePrecision("x").notNull(),
  y: doublePrecision("y").notNull(),
  w: doublePrecision("w"),
  h: doublePrecision("h"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
