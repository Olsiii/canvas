import { db, schema } from "@canvas/db";
import { deleteSsoConfigSchema, getSsoConfigSchema, upsertSsoConfigSchema } from "@canvas/shared";
import { eq } from "drizzle-orm";
import { spEntityId } from "../../auth/saml";
import { assertCan } from "../../lib/permissions";
import { protectedProcedure, router } from "../trpc";

export const ssoRouter = router({
  get: protectedProcedure.input(getSsoConfigSchema).query(async ({ ctx, input }) => {
    await assertCan(ctx.user, input.workspaceId, "sso:view");

    const config = await db.query.ssoConfigs.findFirst({
      where: eq(schema.ssoConfigs.workspaceId, input.workspaceId),
    });
    return {
      config,
      // The admin needs this to configure the IdP side, whether or not a
      // config row exists yet — see auth/saml.ts's buildMetadataOnlySamlClient.
      spEntityId: spEntityId(input.workspaceId),
    };
  }),

  upsert: protectedProcedure.input(upsertSsoConfigSchema).mutation(async ({ ctx, input }) => {
    // Owner tier — see auth/can.ts: this changes how every member of the
    // workspace can authenticate, a bigger blast radius than an admin-tier
    // credential like an API key or webhook.
    await assertCan(ctx.user, input.workspaceId, "sso:update");

    const [config] = await db
      .insert(schema.ssoConfigs)
      .values({
        workspaceId: input.workspaceId,
        idpEntityId: input.idpEntityId,
        idpSsoUrl: input.idpSsoUrl,
        idpCertificate: input.idpCertificate,
        defaultRole: input.defaultRole,
        enabled: input.enabled,
        createdBy: ctx.user.id,
      })
      .onConflictDoUpdate({
        target: schema.ssoConfigs.workspaceId,
        set: {
          idpEntityId: input.idpEntityId,
          idpSsoUrl: input.idpSsoUrl,
          idpCertificate: input.idpCertificate,
          defaultRole: input.defaultRole,
          enabled: input.enabled,
          updatedAt: new Date(),
        },
      })
      .returning();
    return config;
  }),

  delete: protectedProcedure.input(deleteSsoConfigSchema).mutation(async ({ ctx, input }) => {
    await assertCan(ctx.user, input.workspaceId, "sso:update");
    await db.delete(schema.ssoConfigs).where(eq(schema.ssoConfigs.workspaceId, input.workspaceId));
    return { workspaceId: input.workspaceId };
  }),
});
