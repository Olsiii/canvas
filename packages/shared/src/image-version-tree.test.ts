import { describe, expect, it } from "vitest";
import { buildImageVersionTree, flattenImageVersionTree } from "./image-version-tree";

const t = (id: string, parentVersionId: string | null, createdAt: string) => ({
  id,
  parentVersionId,
  createdAt,
});

describe("buildImageVersionTree", () => {
  it("builds a linear chain with increasing depth", () => {
    const roots = buildImageVersionTree([
      t("a", null, "2026-01-01T00:00:00Z"),
      t("b", "a", "2026-01-01T00:01:00Z"),
      t("c", "b", "2026-01-01T00:02:00Z"),
    ]);
    expect(roots).toHaveLength(1);
    expect(roots[0]!.id).toBe("a");
    expect(roots[0]!.depth).toBe(0);
    expect(roots[0]!.children[0]!.id).toBe("b");
    expect(roots[0]!.children[0]!.depth).toBe(1);
    expect(roots[0]!.children[0]!.children[0]!.id).toBe("c");
    expect(roots[0]!.children[0]!.children[0]!.depth).toBe(2);
  });

  it("branches siblings under the same parent, ordered by createdAt", () => {
    const roots = buildImageVersionTree([
      t("root", null, "2026-01-01T00:00:00Z"),
      t("late", "root", "2026-01-01T00:02:00Z"),
      t("early", "root", "2026-01-01T00:01:00Z"),
    ]);
    expect(roots[0]!.children.map((c) => c.id)).toEqual(["early", "late"]);
  });

  it("treats n-variant generates as sibling roots", () => {
    const roots = buildImageVersionTree([
      t("v1", null, "2026-01-01T00:00:00Z"),
      t("v2", null, "2026-01-01T00:00:01Z"),
    ]);
    expect(roots.map((r) => r.id)).toEqual(["v1", "v2"]);
  });

  it("treats orphaned parent links as roots", () => {
    const roots = buildImageVersionTree([t("orphan", "missing", "2026-01-01T00:00:00Z")]);
    expect(roots).toHaveLength(1);
    expect(roots[0]!.id).toBe("orphan");
  });
});

describe("flattenImageVersionTree", () => {
  it("walks depth-first", () => {
    const flat = flattenImageVersionTree(
      buildImageVersionTree([
        t("a", null, "2026-01-01T00:00:00Z"),
        t("b", "a", "2026-01-01T00:01:00Z"),
        t("c", null, "2026-01-01T00:02:00Z"),
      ]),
    );
    expect(flat.map((n) => n.id)).toEqual(["a", "b", "c"]);
    expect(flat.map((n) => n.depth)).toEqual([0, 1, 0]);
  });
});
