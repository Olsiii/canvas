/**
 * Build a forest of image_version nodes from a flat list using parentVersionId.
 * Roots are versions with a null parent (or an orphaned parent). Children are
 * ordered by createdAt ascending within each parent.
 */
export type ImageVersionTreeInput = {
  id: string;
  parentVersionId: string | null;
  createdAt: Date | string;
};

export type ImageVersionTreeNode<T extends ImageVersionTreeInput> = T & {
  depth: number;
  children: ImageVersionTreeNode<T>[];
};

function createdAtMs(value: Date | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

export function buildImageVersionTree<T extends ImageVersionTreeInput>(
  versions: T[],
): ImageVersionTreeNode<T>[] {
  const byId = new Map<string, ImageVersionTreeNode<T>>();
  for (const version of versions) {
    byId.set(version.id, { ...version, depth: 0, children: [] });
  }

  const roots: ImageVersionTreeNode<T>[] = [];
  for (const node of byId.values()) {
    const parentId = node.parentVersionId;
    if (parentId && byId.has(parentId)) {
      byId.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  function sortAndDepth(nodes: ImageVersionTreeNode<T>[], depth: number) {
    nodes.sort((a, b) => createdAtMs(a.createdAt) - createdAtMs(b.createdAt));
    for (const node of nodes) {
      node.depth = depth;
      sortAndDepth(node.children, depth + 1);
    }
  }

  sortAndDepth(roots, 0);
  return roots;
}

/** Depth-first flatten for sidebar rendering. */
export function flattenImageVersionTree<T extends ImageVersionTreeInput>(
  roots: ImageVersionTreeNode<T>[],
): ImageVersionTreeNode<T>[] {
  const out: ImageVersionTreeNode<T>[] = [];
  function walk(nodes: ImageVersionTreeNode<T>[]) {
    for (const node of nodes) {
      out.push(node);
      walk(node.children);
    }
  }
  walk(roots);
  return out;
}
