"use client";

import { useEffect, useState } from "react";
import { Download, FileText, Folder, FolderOpen } from "lucide-react";
import JSZip from "jszip";
import { apiUrl } from "@/lib/api";
import { buildProjectTree, type ProjectTreeEntry } from "@/lib/projectTree";

export function ProjectArchiveTree({ listingId }: { listingId: string }) {
  const [entries, setEntries] = useState<ProjectTreeEntry[] | null>(null);
  const [archiveBlob, setArchiveBlob] = useState<Blob | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function loadArchiveTree() {
      setEntries(null);
      setArchiveBlob(null);
      setError("");
      setLoading(true);
      try {
        const response = await fetch(apiUrl(`/api/admin/software/${encodeURIComponent(listingId)}/project-archive`), {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null) as { message?: string } | null;
          throw new Error(payload?.message || `Could not load project archive (HTTP ${response.status}).`);
        }
        if (!(response.headers.get("content-type") || "").toLowerCase().includes("application/zip")) {
          throw new Error("The project archive response was not a ZIP file.");
        }

        const blob = await response.blob();
        if (!blob.size) throw new Error("The project archive is empty.");
        const archive = await JSZip.loadAsync(blob);
        const tree = buildProjectTree(Object.keys(archive.files));
        if (!tree.length) throw new Error("The project archive contains no files.");
        setEntries(tree);
        setArchiveBlob(blob);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "Could not read the project archive.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadArchiveTree();
    return () => controller.abort();
  }, [listingId]);

  function downloadArchive() {
    if (!archiveBlob) return;
    try {
      const url = URL.createObjectURL(archiveBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${listingId}-project.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not download the project archive.");
    }
  }

  return (
    <section className="listing-detail-section">
      <div className="project-tree-heading">
        <h3>Project folder structure</h3>
        {archiveBlob && <button type="button" className="project-archive-download" onClick={downloadArchive}>
          <Download size={14} /> Download project ZIP
        </button>}
      </div>
      {loading
        ? <p className="project-tree-message" role="status">Loading project files…</p>
        : error
          ? <p className="project-tree-error" role="alert">{error}</p>
          : <div className="project-tree" aria-label="Project folder structure">
            <TreeEntries entries={entries || []} />
          </div>}
    </section>
  );
}

function TreeEntries({ entries }: { entries: ProjectTreeEntry[] }) {
  return (
    <ul>
      {entries.map((entry) => (
        <li key={entry.path} className={entry.directory ? "project-tree-directory" : "project-tree-file"}>
          <span className="project-tree-entry">
            {entry.directory
              ? entry.children.length ? <FolderOpen size={14} /> : <Folder size={14} />
              : <FileText size={14} />}
            <span>{entry.name}</span>
          </span>
          {entry.directory && entry.children.length > 0 && <TreeEntries entries={entry.children} />}
        </li>
      ))}
    </ul>
  );
}
