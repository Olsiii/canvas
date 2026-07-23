import { describe, expect, it } from "vitest";
import { mapSectionStatusKind, parseCsvText, parseImportCsv } from "./csv-import";

describe("parseCsvText", () => {
  it("splits a simple comma-separated grid into rows/cells", () => {
    expect(parseCsvText("a,b,c\n1,2,3\n")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted fields containing commas and embedded newlines", () => {
    const text = 'Name,Notes\n"Ship it","Line one, still one field\nLine two"\n';
    expect(parseCsvText(text)).toEqual([
      ["Name", "Notes"],
      ["Ship it", "Line one, still one field\nLine two"],
    ]);
  });

  it("unescapes doubled quotes inside a quoted field", () => {
    expect(parseCsvText('Name\n"Say ""hi"""\n')).toEqual([["Name"], ['Say "hi"']]);
  });

  it("handles a file with no trailing newline", () => {
    expect(parseCsvText("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("mapSectionStatusKind", () => {
  it("recognizes common 'done' section names regardless of position", () => {
    expect(mapSectionStatusKind("Done", 0)).toBe("done");
    expect(mapSectionStatusKind("Completed", 2)).toBe("done");
    expect(mapSectionStatusKind("Closed", 1)).toBe("done");
  });

  it("falls back to open for the first column, active for the rest", () => {
    expect(mapSectionStatusKind("Backlog", 0)).toBe("open");
    expect(mapSectionStatusKind("In Progress", 1)).toBe("active");
  });
});

describe("parseImportCsv", () => {
  it("parses an Asana-style export using its own column names", () => {
    const csv = [
      "Task ID,Name,Section/Column,Assignee Email,Due Date,Tags,Notes",
      '1,Design homepage,In Progress,ada@example.com,2026-08-01,"design, urgent",Use the new palette',
    ].join("\n");

    const rows = parseImportCsv(csv, "asana");

    expect(rows).toEqual([
      {
        title: "Design homepage",
        statusName: "In Progress",
        description: "Use the new palette",
        assigneeEmail: "ada@example.com",
        dueDate: "2026-08-01",
        tags: ["design", "urgent"],
      },
    ]);
  });

  it("parses a Trello-style export using its own column names", () => {
    const csv = [
      "Card Name,Card List,Card Labels,Card Due Date,Card Description",
      "Fix login bug,Doing,bug,2026-08-05,Users can't log in on Safari",
    ].join("\n");

    const rows = parseImportCsv(csv, "trello");

    expect(rows).toEqual([
      {
        title: "Fix login bug",
        statusName: "Doing",
        description: "Users can't log in on Safari",
        assigneeEmail: null,
        dueDate: "2026-08-05",
        tags: ["bug"],
      },
    ]);
  });

  it("is case-insensitive on headers and tolerates missing optional columns", () => {
    const csv = ["NAME\n", "Just a title\n"].join("");
    const rows = parseImportCsv(csv, "trello");
    expect(rows).toEqual([
      {
        title: "Just a title",
        statusName: null,
        description: null,
        assigneeEmail: null,
        dueDate: null,
        tags: [],
      },
    ]);
  });

  it("skips rows with a blank title", () => {
    const csv = "Name,Notes\n,No title here\nReal task,ok\n";
    const rows = parseImportCsv(csv, "asana");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.title).toBe("Real task");
  });

  it("throws when no title-like column can be found", () => {
    const csv = "Foo,Bar\n1,2\n";
    expect(() => parseImportCsv(csv, "trello")).toThrow(/title/i);
  });
});
