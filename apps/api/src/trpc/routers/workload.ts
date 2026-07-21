import { db, schema } from "@canvas/db";
import { workloadAssignmentsSchema } from "@canvas/shared";
import { and, eq, gte, isNull, lte, or } from "drizzle-orm";
import { assertCan } from "../../lib/permissions";
import { protectedProcedure, router } from "../trpc";

// Same guest-tier gate as task:view — a workload row is just a different
// arrangement of already-visible task/assignee data (M3.5/M3.7 reused
// task:view the same way instead of inventing a new permission action).
export const workloadRouter = router({
  assignments: protectedProcedure.input(workloadAssignmentsSchema).query(async ({ ctx, input }) => {
    await assertCan(ctx.user, input.workspaceId, "task:view");

    // Mirrors taskDateKey's due→start fallback (packages/shared/calendar.ts):
    // a task lands in the range if its due date is in range, or its due
    // date is unset and its start date is in range.
    const landsInRange = or(
      and(gte(schema.tasks.dueDate, input.start), lte(schema.tasks.dueDate, input.end)),
      and(
        isNull(schema.tasks.dueDate),
        gte(schema.tasks.startDate, input.start),
        lte(schema.tasks.startDate, input.end),
      ),
    );

    return db
      .select({
        id: schema.tasks.id,
        title: schema.tasks.title,
        dueDate: schema.tasks.dueDate,
        startDate: schema.tasks.startDate,
        userId: schema.taskAssignees.userId,
      })
      .from(schema.tasks)
      .innerJoin(schema.taskAssignees, eq(schema.taskAssignees.taskId, schema.tasks.id))
      .innerJoin(schema.lists, eq(schema.lists.id, schema.tasks.listId))
      .innerJoin(schema.spaces, eq(schema.spaces.id, schema.lists.spaceId))
      .where(
        and(
          eq(schema.spaces.workspaceId, input.workspaceId),
          isNull(schema.tasks.deletedAt),
          isNull(schema.tasks.parentTaskId),
          landsInRange,
        ),
      );
  }),
});
