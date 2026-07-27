import { db, schema } from "@canvas/db";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { tasksToCsv, type TaskExportRow } from "./csv-export";

interface WorkspaceTaskRow {
  taskId: string;
  title: string;
  descriptionText: string | null;
  priority: string | null;
  startDate: string | null;
  dueDate: string | null;
  completedAt: Date | null;
  createdAt: Date;
  statusName: string;
  listName: string;
  spaceName: string;
  assigneeEmails: string[];
  tags: string[];
}

// Shared by both export formats below — one workspace-wide join for the
// task fields, plus two grouped-by-task lookups for the many-to-many
// assignee/tag relations (a single row-per-task result can't come out of
// one SQL join without duplicating rows per assignee/tag combination).
async function fetchWorkspaceTasks(workspaceId: string): Promise<WorkspaceTaskRow[]> {
  const rows = await db
    .select({
      taskId: schema.tasks.id,
      title: schema.tasks.title,
      descriptionText: schema.tasks.descriptionText,
      priority: schema.tasks.priority,
      startDate: schema.tasks.startDate,
      dueDate: schema.tasks.dueDate,
      completedAt: schema.tasks.completedAt,
      createdAt: schema.tasks.createdAt,
      statusName: schema.statuses.name,
      listName: schema.lists.name,
      spaceName: schema.spaces.name,
    })
    .from(schema.tasks)
    .innerJoin(schema.statuses, eq(schema.statuses.id, schema.tasks.statusId))
    .innerJoin(schema.lists, eq(schema.lists.id, schema.tasks.listId))
    .innerJoin(schema.spaces, eq(schema.spaces.id, schema.lists.spaceId))
    .where(and(eq(schema.spaces.workspaceId, workspaceId), isNull(schema.tasks.deletedAt)))
    .orderBy(asc(schema.spaces.name), asc(schema.lists.name), asc(schema.tasks.orderKey));

  if (rows.length === 0) return [];
  const taskIds = rows.map((r) => r.taskId);

  const [assigneeRows, tagRows] = await Promise.all([
    db
      .select({ taskId: schema.taskAssignees.taskId, email: schema.users.email })
      .from(schema.taskAssignees)
      .innerJoin(schema.users, eq(schema.users.id, schema.taskAssignees.userId))
      .where(inArray(schema.taskAssignees.taskId, taskIds)),
    db
      .select({ taskId: schema.taskTags.taskId, name: schema.tags.name })
      .from(schema.taskTags)
      .innerJoin(schema.tags, eq(schema.tags.id, schema.taskTags.tagId))
      .where(inArray(schema.taskTags.taskId, taskIds)),
  ]);

  const assigneesByTask = new Map<string, string[]>();
  for (const r of assigneeRows) {
    const list = assigneesByTask.get(r.taskId) ?? [];
    list.push(r.email);
    assigneesByTask.set(r.taskId, list);
  }
  const tagsByTask = new Map<string, string[]>();
  for (const r of tagRows) {
    const list = tagsByTask.get(r.taskId) ?? [];
    list.push(r.name);
    tagsByTask.set(r.taskId, list);
  }

  return rows.map((r) => ({
    ...r,
    assigneeEmails: assigneesByTask.get(r.taskId) ?? [],
    tags: tagsByTask.get(r.taskId) ?? [],
  }));
}

export async function buildTasksCsv(workspaceId: string): Promise<string> {
  const tasks = await fetchWorkspaceTasks(workspaceId);
  const rows: TaskExportRow[] = tasks.map((t) => ({
    title: t.title,
    spaceName: t.spaceName,
    listName: t.listName,
    statusName: t.statusName,
    priority: t.priority ?? "",
    assigneeEmails: t.assigneeEmails,
    tags: t.tags,
    startDate: t.startDate,
    dueDate: t.dueDate,
    completedAt: t.completedAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
  }));
  return tasksToCsv(rows);
}

export async function buildWorkspaceExportJson(workspaceId: string) {
  const workspace = await db.query.workspaces.findFirst({
    where: eq(schema.workspaces.id, workspaceId),
  });
  const tasks = await fetchWorkspaceTasks(workspaceId);

  return {
    exportedAt: new Date().toISOString(),
    workspace: { id: workspaceId, name: workspace?.name ?? null },
    tasks: tasks.map((t) => ({
      id: t.taskId,
      title: t.title,
      description: t.descriptionText,
      priority: t.priority,
      space: t.spaceName,
      list: t.listName,
      status: t.statusName,
      assignees: t.assigneeEmails,
      tags: t.tags,
      startDate: t.startDate,
      dueDate: t.dueDate,
      completedAt: t.completedAt?.toISOString() ?? null,
      createdAt: t.createdAt.toISOString(),
    })),
  };
}
