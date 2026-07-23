import { db, schema } from "@canvas/db";
import { csvImportPayloadSchema, type ImportedTaskRow } from "@canvas/shared";
import { and, desc, eq, isNull } from "drizzle-orm";
import { logActivity } from "./activity";
import {
  ClickUpClient,
  mapClickUpPriority,
  mapClickUpStatusKind,
  type ClickUpTask,
} from "./clickup-client";
import { mapSectionStatusKind } from "./csv-import";
import { nextOrderKey } from "./order";
import { extractPlainText } from "./plain-text";
import { publish } from "./realtime";
import { computeCompletedAt } from "./task-update";

const STATUS_KIND_COLOR: Record<"open" | "active" | "done" | "closed", string> = {
  open: "#94a3b8",
  active: "#3b82f6",
  done: "#22c55e",
  closed: "#64748b",
};

interface ImportSummary {
  spacesCreated: number;
  foldersCreated: number;
  listsCreated: number;
  tasksCreated: number;
  tasksSkipped: number;
}

function newSummary(): ImportSummary {
  return {
    spacesCreated: 0,
    foldersCreated: 0,
    listsCreated: 0,
    tasksCreated: 0,
    tasksSkipped: 0,
  };
}

async function requireImport(importId: string) {
  const row = await db.query.imports.findFirst({ where: eq(schema.imports.id, importId) });
  if (!row) throw new Error(`Import ${importId} not found`);
  return row;
}

async function markRunning(importId: string) {
  await db
    .update(schema.imports)
    .set({ status: "running", updatedAt: new Date() })
    .where(eq(schema.imports.id, importId));
}

async function markDone(importId: string, summary: ImportSummary) {
  await db
    .update(schema.imports)
    .set({ status: "done", summaryJson: summary, updatedAt: new Date() })
    .where(eq(schema.imports.id, importId));
}

async function markFailed(importId: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Import failed";
  await db
    .update(schema.imports)
    .set({ status: "failed", error: message, updatedAt: new Date() })
    .where(eq(schema.imports.id, importId));
}

/** Loads workspace members' emails once per import run for assignee matching. */
async function loadMemberEmailMap(workspaceId: string): Promise<Map<string, string>> {
  const rows = await db
    .select({ userId: schema.users.id, email: schema.users.email })
    .from(schema.memberships)
    .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
    .where(eq(schema.memberships.workspaceId, workspaceId));
  return new Map(rows.map((r) => [r.email.toLowerCase(), r.userId]));
}

/** Find-or-create by name, cached per import run — mirrors automation-runner's tag lookup. */
async function resolveTag(
  workspaceId: string,
  cache: Map<string, string>,
  name: string,
): Promise<string> {
  const key = name.trim().toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;

  const existing = await db.query.tags.findFirst({
    where: and(eq(schema.tags.workspaceId, workspaceId), eq(schema.tags.name, name)),
  });
  if (existing) {
    cache.set(key, existing.id);
    return existing.id;
  }

  const [created] = await db
    .insert(schema.tags)
    .values({ workspaceId, name, color: "#64748b" })
    .returning();
  if (!created) throw new Error(`Failed to create tag "${name}"`);
  cache.set(key, created.id);
  return created.id;
}

function toIsoDate(value: string | number | null): string | null {
  if (value === null) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function plainTextToTipTapJson(text: string) {
  const paragraphs = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => ({ type: "paragraph", content: [{ type: "text", text: line }] }));
  return { type: "doc", content: paragraphs };
}

interface NormalizedTask {
  title: string;
  descriptionJson: unknown;
  statusName: string | null;
  // ClickUp's own status.type ("open"/"custom"/"done"/"closed") — ground
  // truth for mapClickUpStatusKind when present. CSV rows have no such
  // field (null), so their status kind falls back to mapSectionStatusKind's
  // name-sniffing/position heuristic instead.
  statusTypeHint: string | null;
  priority: "urgent" | "high" | "normal" | "low" | null;
  dueDate: string | null;
  assigneeEmails: string[];
  tagNames: string[];
}

/** Sequential order-key allocator: one DB read up front, then pure in-memory generation. */
class OrderKeySeries {
  private last: string | null;
  constructor(initial: string | null) {
    this.last = initial;
  }
  next(): string {
    this.last = nextOrderKey(this.last);
    return this.last;
  }
}

// Mirrors hierarchy.ts's own private lastSpaceOrderKey — a fresh copy
// rather than exporting/importing that router's internal helper, same
// "don't reach into another module's private implementation" boundary
// the rest of this codebase keeps between routers and lib/ files.
async function lastSpaceOrderKey(workspaceId: string): Promise<string | null> {
  const [last] = await db
    .select({ orderKey: schema.spaces.orderKey })
    .from(schema.spaces)
    .where(and(eq(schema.spaces.workspaceId, workspaceId), isNull(schema.spaces.deletedAt)))
    .orderBy(desc(schema.spaces.orderKey))
    .limit(1);
  return last?.orderKey ?? null;
}

/**
 * Creates one Canvas list (with statuses derived from the distinct
 * statusName values seen, in first-seen order) inside `spaceId`, then
 * inserts every normalized task into it — the shared leaf-level logic
 * both the ClickUp and CSV import paths funnel into once they've reduced
 * their source data to this common shape.
 */
async function importTasksIntoNewList(
  workspaceId: string,
  spaceId: string,
  folderId: string | null,
  listName: string,
  listOrderKeys: OrderKeySeries,
  tasksIn: NormalizedTask[],
  createdBy: string,
  memberEmails: Map<string, string>,
  tagCache: Map<string, string>,
  summary: ImportSummary,
) {
  const [list] = await db
    .insert(schema.lists)
    .values({ spaceId, folderId, name: listName, orderKey: listOrderKeys.next() })
    .returning();
  if (!list) throw new Error(`Failed to create list "${listName}"`);
  summary.listsCreated++;
  await logActivity(workspaceId, createdBy, "list", list.id, "list.created_from_import");

  const distinctStatusNames: string[] = [];
  const statusTypeHintByName = new Map<string, string>();
  for (const t of tasksIn) {
    if (t.statusName && !distinctStatusNames.includes(t.statusName)) {
      distinctStatusNames.push(t.statusName);
      if (t.statusTypeHint) statusTypeHintByName.set(t.statusName, t.statusTypeHint);
    }
  }
  if (distinctStatusNames.length === 0) distinctStatusNames.push("Imported");

  const statusIdByName = new Map<string, string>();
  const statusKindById = new Map<string, "open" | "active" | "done" | "closed">();
  let statusOrderKey: string | null = null;
  for (const [index, name] of distinctStatusNames.entries()) {
    const typeHint = statusTypeHintByName.get(name);
    const kind = typeHint
      ? mapClickUpStatusKind(typeHint, index)
      : mapSectionStatusKind(name, index);
    statusOrderKey = nextOrderKey(statusOrderKey);
    const [status] = await db
      .insert(schema.statuses)
      .values({
        listId: list.id,
        name,
        color: STATUS_KIND_COLOR[kind],
        kind,
        orderKey: statusOrderKey,
      })
      .returning();
    if (!status) throw new Error(`Failed to create status "${name}"`);
    statusIdByName.set(name, status.id);
    statusKindById.set(status.id, kind);
  }
  const fallbackStatusId = statusIdByName.get(distinctStatusNames[0]!)!;

  const taskOrderKeys = new Map<string, OrderKeySeries>();
  for (const task of tasksIn) {
    const statusId = (task.statusName && statusIdByName.get(task.statusName)) || fallbackStatusId;
    let series = taskOrderKeys.get(statusId);
    if (!series) {
      series = new OrderKeySeries(null);
      taskOrderKeys.set(statusId, series);
    }

    const now = new Date();
    const [created] = await db
      .insert(schema.tasks)
      .values({
        listId: list.id,
        title: task.title,
        descriptionJson: task.descriptionJson,
        descriptionText: task.descriptionJson ? extractPlainText(task.descriptionJson) : null,
        statusId,
        completedAt: computeCompletedAt(statusKindById.get(statusId)!, null, now),
        priority: task.priority,
        dueDate: task.dueDate,
        orderKey: series.next(),
        createdBy,
      })
      .returning();
    if (!created) {
      summary.tasksSkipped++;
      continue;
    }
    summary.tasksCreated++;

    // Dedupe by resolved id, not raw source string — a source row can list
    // the same person/tag twice under slightly different casing, and the
    // join tables' composite PKs reject a duplicate insert.
    const assignedUserIds = new Set<string>();
    for (const email of task.assigneeEmails) {
      const userId = memberEmails.get(email.toLowerCase());
      if (userId && !assignedUserIds.has(userId)) {
        assignedUserIds.add(userId);
        await db.insert(schema.taskAssignees).values({ taskId: created.id, userId });
      }
    }
    const attachedTagIds = new Set<string>();
    for (const tagName of task.tagNames) {
      const tagId = await resolveTag(workspaceId, tagCache, tagName);
      if (!attachedTagIds.has(tagId)) {
        attachedTagIds.add(tagId);
        await db.insert(schema.taskTags).values({ taskId: created.id, tagId });
      }
    }

    await logActivity(workspaceId, createdBy, "task", created.id, "task.created_from_import");
    await publish(workspaceId, {
      entity: "task",
      id: created.id,
      listId: list.id,
      kind: "created",
    });
  }
}

function normalizeClickUpTask(task: ClickUpTask): NormalizedTask {
  return {
    title: task.name,
    descriptionJson: task.text_content ? plainTextToTipTapJson(task.text_content) : null,
    statusName: task.status?.status ?? null,
    statusTypeHint: task.status?.type ?? null,
    priority: mapClickUpPriority(task.priority),
    dueDate: toIsoDate(task.due_date),
    assigneeEmails: task.assignees.map((a) => a.email),
    tagNames: task.tags.map((t) => t.name),
  };
}

function normalizeCsvRow(row: ImportedTaskRow): NormalizedTask {
  return {
    title: row.title,
    descriptionJson: row.description ? plainTextToTipTapJson(row.description) : null,
    statusName: row.statusName,
    statusTypeHint: null,
    priority: null,
    dueDate: toIsoDate(row.dueDate),
    assigneeEmails: row.assigneeEmail ? [row.assigneeEmail] : [],
    tagNames: row.tags,
  };
}

/**
 * Imports the whole workspace a ClickUp API token has access to (first
 * authorized team — see PROGRESS.md decisions): every space, its folders
 * and folderless lists, and every task in every list, mapped 1:1 onto
 * Canvas's own space/folder/list/task hierarchy.
 */
export async function runClickUpImport(importId: string, apiToken: string): Promise<void> {
  const importRow = await requireImport(importId);
  await markRunning(importId);
  const summary = newSummary();

  try {
    const client = new ClickUpClient(apiToken);
    const teams = await client.getAuthorizedTeams();
    const team = teams[0];
    if (!team) throw new Error("This ClickUp token has no authorized workspaces");

    const memberEmails = await loadMemberEmailMap(importRow.workspaceId);
    const tagCache = new Map<string, string>();

    const spaceLastKey = await lastSpaceOrderKey(importRow.workspaceId);
    const spaceOrderKeys = new OrderKeySeries(spaceLastKey);

    const clickUpSpaces = await client.getSpaces(team.id);
    for (const cuSpace of clickUpSpaces) {
      const [space] = await db
        .insert(schema.spaces)
        .values({
          workspaceId: importRow.workspaceId,
          name: cuSpace.name,
          orderKey: spaceOrderKeys.next(),
        })
        .returning();
      if (!space) throw new Error(`Failed to create space "${cuSpace.name}"`);
      summary.spacesCreated++;
      await logActivity(
        importRow.workspaceId,
        importRow.createdBy,
        "space",
        space.id,
        "space.created_from_import",
      );

      const folderOrderKeys = new OrderKeySeries(null);
      const listOrderKeys = new OrderKeySeries(null);

      const folders = await client.getFolders(cuSpace.id);
      for (const cuFolder of folders) {
        const [folder] = await db
          .insert(schema.folders)
          .values({ spaceId: space.id, name: cuFolder.name, orderKey: folderOrderKeys.next() })
          .returning();
        if (!folder) throw new Error(`Failed to create folder "${cuFolder.name}"`);
        summary.foldersCreated++;

        const cuLists = await client.getListsInFolder(cuFolder.id);
        for (const cuList of cuLists) {
          const cuTasks = await client.getTasks(cuList.id);
          await importTasksIntoNewList(
            importRow.workspaceId,
            space.id,
            folder.id,
            cuList.name,
            listOrderKeys,
            cuTasks.map(normalizeClickUpTask),
            importRow.createdBy,
            memberEmails,
            tagCache,
            summary,
          );
        }
      }

      const folderlessLists = await client.getFolderlessLists(cuSpace.id);
      for (const cuList of folderlessLists) {
        const cuTasks = await client.getTasks(cuList.id);
        await importTasksIntoNewList(
          importRow.workspaceId,
          space.id,
          null,
          cuList.name,
          listOrderKeys,
          cuTasks.map(normalizeClickUpTask),
          importRow.createdBy,
          memberEmails,
          tagCache,
          summary,
        );
      }
    }

    await markDone(importId, summary);
  } catch (err) {
    await markFailed(importId, err);
  }
}

/** Imports a single Trello/Asana CSV export as one new space containing one new list. */
export async function runCsvImport(importId: string): Promise<void> {
  const importRow = await requireImport(importId);
  await markRunning(importId);
  const summary = newSummary();

  try {
    const payload = csvImportPayloadSchema.parse(importRow.payloadJson);

    const memberEmails = await loadMemberEmailMap(importRow.workspaceId);
    const tagCache = new Map<string, string>();

    const spaceLastKey = await lastSpaceOrderKey(importRow.workspaceId);
    const spaceOrderKeys = new OrderKeySeries(spaceLastKey);

    const [space] = await db
      .insert(schema.spaces)
      .values({
        workspaceId: importRow.workspaceId,
        name: payload.spaceName,
        orderKey: spaceOrderKeys.next(),
      })
      .returning();
    if (!space) throw new Error(`Failed to create space "${payload.spaceName}"`);
    summary.spacesCreated++;
    await logActivity(
      importRow.workspaceId,
      importRow.createdBy,
      "space",
      space.id,
      "space.created_from_import",
    );

    await importTasksIntoNewList(
      importRow.workspaceId,
      space.id,
      null,
      payload.listName,
      new OrderKeySeries(null),
      payload.rows.map(normalizeCsvRow),
      importRow.createdBy,
      memberEmails,
      tagCache,
      summary,
    );

    await markDone(importId, summary);
  } catch (err) {
    await markFailed(importId, err);
  }
}
