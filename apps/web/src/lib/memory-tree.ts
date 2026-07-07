export interface MemoryTreeNode {
  name: string;
  path: string;
  type: "folder" | "file";
  children?: MemoryTreeNode[];
}

function sortMemoryTree(nodes: MemoryTreeNode[]) {
  nodes.sort((a, b) =>
    a.type !== b.type
      ? a.type === "folder"
        ? -1
        : 1
      : a.name.localeCompare(b.name),
  );
  for (const node of nodes) {
    if (node.children) sortMemoryTree(node.children);
  }
}

/** Builds a tree from flat memory keys (e.g. "wiki/architecture.md") by grouping on "/". */
export function buildMemoryTree(keys: string[]): MemoryTreeNode[] {
  const root: MemoryTreeNode[] = [];
  const folders = new Map<string, MemoryTreeNode>();

  for (const key of keys) {
    const parts = key.split("/");
    let siblings = root;
    let currentPath = "";

    parts.forEach((part, index) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isFile = index === parts.length - 1;

      if (isFile) {
        siblings.push({ name: part, path: currentPath, type: "file" });
        return;
      }

      let folder = folders.get(currentPath);
      if (!folder) {
        folder = { name: part, path: currentPath, type: "folder", children: [] };
        folders.set(currentPath, folder);
        siblings.push(folder);
      }
      siblings = folder.children!;
    });
  }

  sortMemoryTree(root);

  return root;
}
