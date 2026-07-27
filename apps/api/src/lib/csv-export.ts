// Reverse of csv-import.ts's parseCsvText — RFC4180-ish serialization
// (quote a field only when it contains a comma/quote/newline; double up
// embedded quotes). Column names deliberately match csv-import.ts's own
// COLUMN_ALIASES ("Name", "Status", "Assignee Email", "Tags", "Due Date")
// so a round-trip export -> re-import elsewhere finds its columns without
// remapping; the extra columns import doesn't look for (Space, List,
// Priority, Start Date, Completed At, Created At) are simply ignored by it.
export const TASK_CSV_HEADERS = [
  "Name",
  "Space",
  "List",
  "Status",
  "Priority",
  "Assignee Email",
  "Tags",
  "Start Date",
  "Due Date",
  "Completed At",
  "Created At",
] as const;

export interface TaskExportRow {
  title: string;
  spaceName: string;
  listName: string;
  statusName: string;
  priority: string;
  assigneeEmails: string[];
  tags: string[];
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
}

function csvEscape(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function tasksToCsv(rows: TaskExportRow[]): string {
  const lines = [TASK_CSV_HEADERS.join(",")];
  for (const row of rows) {
    const cells = [
      row.title,
      row.spaceName,
      row.listName,
      row.statusName,
      row.priority,
      row.assigneeEmails.join("; "),
      row.tags.join("; "),
      row.startDate ?? "",
      row.dueDate ?? "",
      row.completedAt ?? "",
      row.createdAt,
    ];
    lines.push(cells.map(csvEscape).join(","));
  }
  return lines.join("\r\n");
}
