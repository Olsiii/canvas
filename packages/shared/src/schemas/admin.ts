import { z } from "zod";

export const workspaceAdminSchema = z.object({
  workspaceId: z.string().uuid(),
});
