import { TRPCError } from "@trpc/server";
import type { WorkspaceAction } from "../auth/can";
import { can } from "../auth/can";
import type { SessionUser } from "../auth/session";
import { getMembershipRole } from "./membership";

export async function assertCan(user: SessionUser, workspaceId: string, action: WorkspaceAction) {
  const role = await getMembershipRole(workspaceId, user.id);
  if (!can(user, action, { type: "workspace", role })) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
}
