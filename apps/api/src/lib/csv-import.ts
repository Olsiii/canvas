import type { ImportedTaskRow } from "@canvas/shared";

/**
 * Minimal RFC4180-ish CSV tokenizer: quoted fields, embedded commas/
 * newlines inside quotes, and `""` as an escaped quote. No external CSV
 * library is used elsewhere in this repo, and the format is small enough
 * to implement directly and unit test rather than add a dependency for.
 */
export function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  function endField() {
    row.push(field);
    field = "";
  }
  function endRow() {
    endField();
    rows.push(row);
    row = [];
  }

  while (i < text.length) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += char;
      i++;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (char === ",") {
      endField();
      i++;
      continue;
    }
    if (char === "\r") {
      i++;
      continue;
    }
    if (char === "\n") {
      endRow();
      i++;
      continue;
    }
    field += char;
    i++;
  }
  // Trailing field/row (a file that doesn't end in a newline).
  if (field.length > 0 || row.length > 0) endRow();

  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

// No single canonical CSV schema exists for either tool: Trello's own
// native export is JSON (CSV comes only from third-party board exporters,
// whose column names vary), and Asana's CSV columns vary by which fields
// were selected at export time. Rather than hard-coding one fixed header
// set, every logical field is matched against a tolerant, case-insensitive
// list of aliases seen across both tools' common exporters. See
// PROGRESS.md (M5.5 decisions).
const COLUMN_ALIASES: Record<keyof ImportedTaskRowInput, string[]> = {
  title: ["name", "task name", "card name", "title"],
  statusName: ["section/column", "section", "column", "card list", "list", "list name", "status"],
  description: ["notes", "description", "card description", "desc"],
  assigneeEmail: ["assignee email", "assignee e-mail", "assignee"],
  dueDate: ["due date", "card due date"],
  tags: ["tags", "labels", "card labels"],
};

interface ImportedTaskRowInput {
  title: string;
  statusName: string;
  description: string;
  assigneeEmail: string;
  dueDate: string;
  tags: string;
}

function findColumnIndex(headerRow: string[], aliases: string[]): number {
  const normalized = headerRow.map((h) => h.trim().toLowerCase());
  for (const alias of aliases) {
    const index = normalized.indexOf(alias);
    if (index !== -1) return index;
  }
  return -1;
}

/**
 * Buckets a CSV "section/list" column value into the open/active/done/
 * closed vocabulary every status carries — a CSV export has no typed
 * status field of its own, so this falls back to name-sniffing common
 * "done" column names, then position (first column = open, rest = active).
 */
export function mapSectionStatusKind(
  name: string,
  index: number,
): "open" | "active" | "done" | "closed" {
  if (/done|complete|closed|finished/i.test(name)) return "done";
  return index === 0 ? "open" : "active";
}

/**
 * Parses a CSV export into the tool-agnostic row shape import-runner.ts
 * writes tasks from. Throws if no title-like column is found — everything
 * else is optional and simply comes back null/empty.
 */
export function parseImportCsv(csvText: string): ImportedTaskRow[] {
  const rows = parseCsvText(csvText);
  if (rows.length === 0) return [];

  const [headerRow, ...dataRows] = rows;
  if (!headerRow) return [];

  const titleIndex = findColumnIndex(headerRow, COLUMN_ALIASES.title);
  if (titleIndex === -1) {
    throw new Error(
      `Couldn't find a task name/title column in this CSV (looked for: ${COLUMN_ALIASES.title.join(", ")}).`,
    );
  }
  const statusIndex = findColumnIndex(headerRow, COLUMN_ALIASES.statusName);
  const descriptionIndex = findColumnIndex(headerRow, COLUMN_ALIASES.description);
  const assigneeEmailIndex = findColumnIndex(headerRow, COLUMN_ALIASES.assigneeEmail);
  const dueDateIndex = findColumnIndex(headerRow, COLUMN_ALIASES.dueDate);
  const tagsIndex = findColumnIndex(headerRow, COLUMN_ALIASES.tags);

  const cell = (row: string[], index: number): string | null => {
    if (index === -1) return null;
    const value = row[index]?.trim();
    return value && value.length > 0 ? value : null;
  };

  return dataRows
    .map((row): ImportedTaskRow | null => {
      const title = cell(row, titleIndex);
      if (!title) return null;
      const tagsCell = cell(row, tagsIndex);
      return {
        title,
        statusName: cell(row, statusIndex),
        description: cell(row, descriptionIndex),
        assigneeEmail: cell(row, assigneeEmailIndex),
        dueDate: cell(row, dueDateIndex),
        tags: tagsCell
          ? tagsCell
              .split(",")
              .map((t) => t.trim())
              .filter((t) => t.length > 0)
          : [],
      };
    })
    .filter((r): r is ImportedTaskRow => r !== null);
}
