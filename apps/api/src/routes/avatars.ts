import { db, schema } from "@canvas/db";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { Readable } from "node:stream";
import { getSessionUser } from "../auth/session";
import { processImage } from "../lib/image-processing";
import { getObject, putObject } from "../lib/storage";

// Same plain multipart Fastify route reasoning as image-assets.ts's
// /image-assets/upload — tRPC has no file transport. Unlike Library
// assets, an avatar has no version history and exactly one consumption
// size everywhere it's displayed, so it's stored at a single fixed key per
// user (overwritten in place on re-upload) rather than a fresh id per
// upload — simplest option, no orphaned S3 objects to worry about.
export function registerAvatarRoutes(app: FastifyInstance) {
  app.post("/avatars", async (req, reply) => {
    const user = await getSessionUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });

    let file: { buffer: Buffer; mimetype: string } | undefined;
    for await (const part of req.parts()) {
      if (part.type === "file") {
        file = { buffer: await part.toBuffer(), mimetype: part.mimetype };
      }
    }
    if (!file) return reply.code(400).send({ error: "Missing file" });

    // svg starts with "image/" but can embed <script> and execute it when
    // served back as a direct URL — same rejection as image-assets.ts.
    if (!file.mimetype.startsWith("image/") || file.mimetype.toLowerCase() === "image/svg+xml") {
      return reply.code(400).send({ error: "File must be an image" });
    }

    const processed = await processImage(file.buffer);
    if (!processed) {
      return reply.code(400).send({ error: "Could not read this file as an image" });
    }

    const thumbKey = `avatars/${user.id}/thumb.webp`;
    await putObject(thumbKey, processed.thumbBuffer, processed.thumbContentType);

    // Every other served-image URL in this app is cache-safe by
    // construction (a fresh id per upload/version) — an avatar is the one
    // case where the same entity id's underlying content can change, so
    // this bakes a cache-busting `?v=` into the stored URL itself rather
    // than inventing an ETag/conditional-request scheme: `<img src>`
    // naturally reloads once the string changes, and it rides along for
    // free everywhere avatarUrl already gets refetched.
    const updatedAt = new Date();
    const avatarUrl = `/avatars/${user.id}?v=${updatedAt.getTime()}`;
    await db.update(schema.users).set({ avatarUrl, updatedAt }).where(eq(schema.users.id, user.id));

    return reply.send({ avatarUrl });
  });

  app.get<{ Params: { userId: string } }>("/avatars/:userId", async (req, reply) => {
    // Authenticated-only, not workspace-scoped: every UI surface that hands
    // the client a userId to fetch an avatar for (DM list, channel
    // messages, members list) is already gated by its own workspace-scoped
    // can()/membership check upstream of this — a low-sensitivity image
    // fetch doesn't need a redundant one here.
    const requester = await getSessionUser(req);
    if (!requester) return reply.code(401).send({ error: "Unauthorized" });

    const target = await db.query.users.findFirst({
      where: eq(schema.users.id, req.params.userId),
    });
    if (!target?.avatarUrl) return reply.code(404).send({ error: "Not found" });

    const thumbKey = `avatars/${target.id}/thumb.webp`;
    const object = await getObject(thumbKey);
    // Always server-produced via processImage (webp) — no user-controlled
    // mimetype ever reaches this route, unlike image-assets.ts's original-
    // file path, so no mime-safety downgrade is needed.
    reply.header("Content-Type", "image/webp");
    reply.header("X-Content-Type-Options", "nosniff");
    // Safe as an immutable, far-future cache: the URL is unique per
    // version via the `?v=` query param baked in at upload time above.
    reply.header("Cache-Control", "private, max-age=31536000, immutable");
    return reply.send(object.Body as Readable);
  });
}
