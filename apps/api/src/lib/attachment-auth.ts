import { TRPCError } from "@trpc/server";
import type { SessionUser } from "../auth/session";
import { isChannelMember, requireChannel, requireMessage } from "./chat-queries";
import { assertCan } from "./permissions";
import { workspaceIdForTask } from "./task-queries";

/**
 * Exactly one of taskId/messageId identifies where an attachment is going
 * — resolves the workspace and checks the caller can actually create an
 * attachment there, including the private-channel-membership check a bare
 * workspace-level permission can't express on its own (a workspace member
 * shouldn't be able to attach a file to a message in a private channel
 * they're not in). Shared by attachment.list/presignUpload/confirmUpload
 * so the three don't drift out of sync with each other or with the plain
 * REST download route's equivalent check.
 */
export async function requireAttachmentTarget(
  user: SessionUser,
  target: { taskId?: string; messageId?: string },
): Promise<{ workspaceId: string }> {
  if (target.messageId) {
    const message = await requireMessage(target.messageId);
    const channel = await requireChannel(message.channelId);
    await assertCan(user, channel.workspaceId, "message:create");
    if (channel.isPrivate && !(await isChannelMember(channel.id, user.id))) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return { workspaceId: channel.workspaceId };
  }

  if (!target.taskId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "taskId or messageId is required" });
  }
  const workspaceId = await workspaceIdForTask(target.taskId);
  await assertCan(user, workspaceId, "attachment:create");
  return { workspaceId };
}
