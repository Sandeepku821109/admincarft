export interface ProjectTreeEntry {
  name: string;
  path: string;
  directory: boolean;
  children: ProjectTreeEntry[];
}

export function buildProjectTree(paths: string[]): ProjectTreeEntry[] {
  const roots: ProjectTreeEntry[] = [];
  const directories = new Map<string, ProjectTreeEntry>();

  for (const archivePath of paths) {
    const path = archivePath.replace(/\\/g, "/");
    if (path.startsWith("/") || /^[a-z]:/i.test(path)) continue;
    const segments = path.split("/").filter(Boolean);
    if (!segments.length || segments.some((segment) => segment === "." || segment === "..")) continue;

    let parentPath = "";
    let parentEntries = roots;
    segments.forEach((name, index) => {
      const currentPath = parentPath ? `${parentPath}/${name}` : name;
      const isDirectory = index < segments.length - 1 || archivePath.endsWith("/") || archivePath.endsWith("\\");
      let entry = directories.get(currentPath);
      if (!entry) {
        entry = { name, path: currentPath, directory: isDirectory, children: [] };
        parentEntries.push(entry);
        directories.set(currentPath, entry);
      } else if (isDirectory) {
        entry.directory = true;
      }

      parentPath = currentPath;
      parentEntries = entry.children;
    });
  }

  function sortEntries(entries: ProjectTreeEntry[]) {
    entries.sort((left, right) =>
      Number(right.directory) - Number(left.directory) || left.name.localeCompare(right.name)
    );
    entries.forEach((entry) => sortEntries(entry.children));
  }

  sortEntries(roots);
  return roots;
}
