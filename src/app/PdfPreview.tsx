"use client";

import { useEffect, useState } from "react";
import { ExternalLink, FileText } from "lucide-react";
import { apiUrl } from "@/lib/api";
import { getPdfPreviewPath } from "@/lib/pdf";

export function PdfPreview({ listingId, title }: { listingId: string; title: string }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | null = null;

    async function loadPdf() {
      setPreviewUrl(null);
      setError(null);
      try {
        const response = await fetch(apiUrl(getPdfPreviewPath(listingId)), {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null) as { message?: string } | null;
          throw new Error(payload?.message || `Could not load product guide (HTTP ${response.status}).`);
        }
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.toLowerCase().includes("application/pdf")) {
          throw new Error("The product guide response was not a PDF.");
        }
        const file = await response.blob();
        if (!file.size) throw new Error("The product guide is empty.");
        objectUrl = URL.createObjectURL(file);
        setPreviewUrl(objectUrl);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "Could not load product guide.");
      }
    }

    void loadPdf();
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [listingId]);

  return (
    <>
      <div className="listing-pdf-preview">
        {previewUrl
          ? <iframe title={`${title} product guide PDF`} src={previewUrl} />
          : error
            ? <p className="listing-pdf-error" role="alert">{error}</p>
            : <p className="listing-pdf-loading" role="status">Loading product guide…</p>}
      </div>
      {previewUrl && <a className="listing-pdf-open" href={previewUrl} target="_blank" rel="noreferrer">
        <FileText size={15} /> Open or download product guide <ExternalLink size={12} />
      </a>}
    </>
  );
}
