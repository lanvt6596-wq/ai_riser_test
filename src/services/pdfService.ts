import { PdfSourceResponse } from "../types";

// In-memory cache for signed PDF URLs to avoid fetching repeatedly within their valid duration
const pdfUrlCache = new Map<string, { url: string; book_name: string; expiresAt: number }>();

/**
 * Fetches a fresh or cached signed PDF URL for the given source_id.
 */
export async function getSourcePdfUrl(sourceId: string): Promise<{ url: string; book_name: string }> {
  if (!sourceId) {
    throw new Error("Không có mã nguồn sử liệu (source_id).");
  }

  const cleanId = sourceId.trim();
  const cached = pdfUrlCache.get(cleanId);
  const now = Date.now();

  // If cache is valid (with 2-minute safety buffer), return cached URL
  if (cached && cached.expiresAt > now + 120 * 1000) {
    return { url: cached.url, book_name: cached.book_name };
  }

  try {
    const response = await fetch(`/api/source-pdf?source_id=${encodeURIComponent(cleanId)}`);
    if (!response.ok) {
      let msg = `Lỗi tải PDF (${response.status})`;
      try {
        const data = await response.json();
        if (data?.error) msg = data.error;
      } catch {}
      throw new Error(msg);
    }

    const data: PdfSourceResponse = await response.json();
    if (!data.url) {
      throw new Error("Không tìm thấy đường dẫn tệp PDF cho nguồn này.");
    }

    const expiresInSec = data.expires_in || 3600;
    const expiresAt = now + expiresInSec * 1000;

    pdfUrlCache.set(cleanId, {
      url: data.url,
      book_name: data.book_name || cleanId,
      expiresAt,
    });

    return {
      url: data.url,
      book_name: data.book_name || cleanId,
    };
  } catch (err: any) {
    console.error(`Failed to load PDF for source '${cleanId}':`, err);
    throw err;
  }
}
