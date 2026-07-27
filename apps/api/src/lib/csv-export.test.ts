import { describe, expect, it } from "vitest";
import { tasksToCsv, TASK_CSV_HEADERS, type TaskExportRow } from "./csv-export";

function row(overrides: Partial<TaskExportRow> = {}): TaskExportRow {
  return {
    title: "Ship the launch email",
    spaceName: "Marketing",
    listName: "Sprint",
    statusName: "In Progress",
    priority: "high",
    assigneeEmails: [],
    tags: [],
    startDate: null,
    dueDate: null,
    completedAt: null,
    createdAt: "2026-07-24T00:00:00.000Z",
    ...overrides,
  };
}

describe("tasksToCsv", () => {
  it("writes the header row even with no tasks", () => {
    expect(tasksToCsv([])).toBe(TASK_CSV_HEADERS.join(","));
  });

  it("writes one row per task in column order", () => {
    const csv = tasksToCsv([row({ dueDate: "2026-08-01" })]);
    const [header, dataRow] = csv.split("\r\n");
    expect(header).toBe(TASK_CSV_HEADERS.join(","));
    expect(dataRow).toBe(
      "Ship the launch email,Marketing,Sprint,In Progress,high,,,,2026-08-01,,2026-07-24T00:00:00.000Z",
    );
  });

  it("joins multiple assignees and tags with a semicolon", () => {
    const csv = tasksToCsv([
      row({ assigneeEmails: ["a@example.com", "b@example.com"], tags: ["bug", "urgent"] }),
    ]);
    expect(csv).toContain("a@example.com; b@example.com");
    expect(csv).toContain("bug; urgent");
  });

  it("quotes a field containing a comma", () => {
    const csv = tasksToCsv([row({ title: "Ship it, then tell marketing" })]);
    expect(csv).toContain('"Ship it, then tell marketing"');
  });

  it("quotes and doubles embedded quotes", () => {
    const csv = tasksToCsv([row({ title: 'Say "ship it" today' })]);
    expect(csv).toContain('"Say ""ship it"" today"');
  });

  it("quotes a field containing a newline", () => {
    const csv = tasksToCsv([row({ title: "Line one\nLine two" })]);
    expect(csv).toContain('"Line one\nLine two"');
  });

  it("leaves an ordinary field unquoted", () => {
    const csv = tasksToCsv([row({ title: "Plain title" })]);
    expect(csv).toContain("\r\nPlain title,");
  });
});
