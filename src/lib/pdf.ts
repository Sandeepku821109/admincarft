export function getPdfPreviewPath(listingId: string): string {
  return `/api/admin/software/${encodeURIComponent(listingId)}/pdf`;
}
