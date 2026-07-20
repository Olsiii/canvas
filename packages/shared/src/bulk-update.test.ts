import { bulkUpdateTasksSchema } from "./schemas/tasks";
import { describe, expect, it } from "vitest";

describe("bulkUpdateTasksSchema", () => {
  const base = {
    listId: "01900000-0000-7000-8000-000000000001",
    taskIds: ["01900000-0000-7000-8000-000000000002"],
  };

  it("requires at least one field", () => {
    expect(() => bulkUpdateTasksSchema.parse(base)).toThrow();
  });

  it("accepts a status patch", () => {
    const parsed = bulkUpdateTasksSchema.parse({
      ...base,
      statusId: "01900000-0000-7000-8000-000000000003",
    });
    expect(parsed.statusId).toBeDefined();
  });

  it("accepts clearing priority", () => {
    const parsed = bulkUpdateTasksSchema.parse({ ...base, priority: null });
    expect(parsed.priority).toBeNull();
  });
});
