import { env } from "../env";

export interface ClickUpTeam {
  id: string;
  name: string;
}

export interface ClickUpSpace {
  id: string;
  name: string;
}

export interface ClickUpFolder {
  id: string;
  name: string;
}

export interface ClickUpList {
  id: string;
  name: string;
}

export interface ClickUpTask {
  id: string;
  name: string;
  text_content: string | null;
  status: { status: string; type: string } | null;
  priority: { id: string } | null;
  due_date: string | null;
  assignees: { email: string }[];
  tags: { name: string }[];
}

/**
 * Thin wrapper over ClickUp's REST API v2. `baseUrl` defaults to the real
 * API but is injectable (and overridden workspace-wide via
 * CLICKUP_API_BASE_URL in test envs — see env.ts) so the importer spec can
 * point it at a local mock server instead of the real ClickUp, the same
 * "configurable endpoint, mockable in tests" seam ImageEngine's adapters
 * would use if they made real HTTP calls yet (see PROGRESS.md decisions).
 */
export class ClickUpClient {
  constructor(
    private readonly token: string,
    private readonly baseUrl: string = env.CLICKUP_API_BASE_URL,
  ) {}

  private async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: { Authorization: this.token },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      throw new Error(`ClickUp API ${path} failed with status ${response.status}`);
    }
    return (await response.json()) as T;
  }

  async getAuthorizedTeams(): Promise<ClickUpTeam[]> {
    const { teams } = await this.get<{ teams: ClickUpTeam[] }>("/team");
    return teams;
  }

  async getSpaces(teamId: string): Promise<ClickUpSpace[]> {
    const { spaces } = await this.get<{ spaces: ClickUpSpace[] }>(
      `/team/${teamId}/space?archived=false`,
    );
    return spaces;
  }

  async getFolders(spaceId: string): Promise<ClickUpFolder[]> {
    const { folders } = await this.get<{ folders: ClickUpFolder[] }>(
      `/space/${spaceId}/folder?archived=false`,
    );
    return folders;
  }

  async getFolderlessLists(spaceId: string): Promise<ClickUpList[]> {
    const { lists } = await this.get<{ lists: ClickUpList[] }>(
      `/space/${spaceId}/list?archived=false`,
    );
    return lists;
  }

  async getListsInFolder(folderId: string): Promise<ClickUpList[]> {
    const { lists } = await this.get<{ lists: ClickUpList[] }>(
      `/folder/${folderId}/list?archived=false`,
    );
    return lists;
  }

  async getTasks(listId: string): Promise<ClickUpTask[]> {
    const { tasks } = await this.get<{ tasks: ClickUpTask[] }>(
      `/list/${listId}/task?archived=false&subtasks=false`,
    );
    return tasks;
  }
}

const CLICKUP_PRIORITY_BY_ID: Record<string, "urgent" | "high" | "normal" | "low"> = {
  "1": "urgent",
  "2": "high",
  "3": "normal",
  "4": "low",
};

export function mapClickUpPriority(
  priority: ClickUpTask["priority"],
): "urgent" | "high" | "normal" | "low" | null {
  if (!priority) return null;
  return CLICKUP_PRIORITY_BY_ID[priority.id] ?? null;
}

/**
 * ClickUp's `status.type` is one of "open"/"custom"/"done"/"closed" but
 * doesn't distinguish "the first column" from "a middle column" the way
 * Canvas's `statuses.kind` wants to for board rendering — both "open" and
 * "custom" collapse to Canvas's "active" except for the very first status
 * in the list, which becomes "open". Pure so it's unit-testable without a
 * live API.
 */
export function mapClickUpStatusKind(
  type: string,
  index: number,
): "open" | "active" | "done" | "closed" {
  if (type === "done") return "done";
  if (type === "closed") return "closed";
  return index === 0 ? "open" : "active";
}
