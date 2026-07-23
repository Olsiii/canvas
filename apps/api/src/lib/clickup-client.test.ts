import { afterEach, describe, expect, it, vi } from "vitest";
import { ClickUpClient, mapClickUpPriority, mapClickUpStatusKind } from "./clickup-client";

describe("mapClickUpPriority", () => {
  it("maps ClickUp's 1-4 priority ids to Canvas's priority enum", () => {
    expect(mapClickUpPriority({ id: "1" })).toBe("urgent");
    expect(mapClickUpPriority({ id: "2" })).toBe("high");
    expect(mapClickUpPriority({ id: "3" })).toBe("normal");
    expect(mapClickUpPriority({ id: "4" })).toBe("low");
  });

  it("returns null when the task has no priority set", () => {
    expect(mapClickUpPriority(null)).toBeNull();
  });

  it("returns null for an unrecognized priority id", () => {
    expect(mapClickUpPriority({ id: "99" })).toBeNull();
  });
});

describe("mapClickUpStatusKind", () => {
  it("maps done/closed types directly regardless of position", () => {
    expect(mapClickUpStatusKind("done", 0)).toBe("done");
    expect(mapClickUpStatusKind("closed", 3)).toBe("closed");
  });

  it("maps the first open/custom status to open, later ones to active", () => {
    expect(mapClickUpStatusKind("open", 0)).toBe("open");
    expect(mapClickUpStatusKind("custom", 0)).toBe("open");
    expect(mapClickUpStatusKind("custom", 1)).toBe("active");
    expect(mapClickUpStatusKind("open", 2)).toBe("active");
  });
});

describe("ClickUpClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetchJson(body: unknown) {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(body),
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("sends the token as a raw Authorization header, not Bearer-prefixed", async () => {
    const fetchMock = stubFetchJson({ teams: [{ id: "t1", name: "My Team" }] });
    const client = new ClickUpClient("pk_test_token", "https://fake.clickup.test/api/v2");

    const teams = await client.getAuthorizedTeams();

    expect(teams).toEqual([{ id: "t1", name: "My Team" }]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://fake.clickup.test/api/v2/team",
      expect.objectContaining({ headers: { Authorization: "pk_test_token" } }),
    );
  });

  it("throws with the failing status when the API responds non-2xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401, json: () => Promise.resolve({}) }),
    );
    const client = new ClickUpClient("bad-token", "https://fake.clickup.test/api/v2");

    await expect(client.getAuthorizedTeams()).rejects.toThrow(/401/);
  });

  it("fetches spaces/folders/lists/tasks against the expected paths", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ spaces: [{ id: "s1", name: "Space" }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ folders: [{ id: "f1", name: "Folder" }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ lists: [{ id: "l1", name: "List" }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            tasks: [
              {
                id: "task1",
                name: "Ship it",
                text_content: "desc",
                status: { status: "in progress", type: "custom" },
                priority: { id: "2" },
                due_date: "1700000000000",
                assignees: [{ email: "a@example.com" }],
                tags: [{ name: "urgent" }],
              },
            ],
          }),
      });
    vi.stubGlobal("fetch", fetchMock);
    const client = new ClickUpClient("token", "https://fake.clickup.test/api/v2");

    await client.getSpaces("team1");
    await client.getFolders("space1");
    await client.getFolderlessLists("space1");
    const tasks = await client.getTasks("list1");

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://fake.clickup.test/api/v2/team/team1/space?archived=false",
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://fake.clickup.test/api/v2/space/space1/folder?archived=false",
    );
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      "https://fake.clickup.test/api/v2/space/space1/list?archived=false",
    );
    expect(tasks[0]?.name).toBe("Ship it");
  });
});
