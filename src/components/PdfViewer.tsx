import React, { useEffect, useRef, useState } from "react";
import { AlertCircle, BookOpen, LoaderCircle } from "lucide-react";
import { getEvidenceView, getSourcePageImageUrl } from "../services/pdfService";
import type { SourcePageView } from "../types";

interface PdfViewerProps {
  sourceId: string;
  bookTitle?: string;
  initialPage: number;
  highlightText: string;
  highlightPages: number[];
  onHighlightStatusChange?: (found: boolean) => void;
}

interface PageViewProps {
  sourceId: string;
  page: SourcePageView;
  isTarget: boolean;
}

const PageView: React.FC<PageViewProps> = ({ sourceId, page, isTarget }) => {
  return (
    <div
      data-source-page={page.page}
      className={`relative bg-white shadow-sm border rounded-lg overflow-hidden ${
        isTarget ? "border-amber-400" : "border-gray-200"
      }`}
    >
      <img
        src={getSourcePageImageUrl(sourceId, page.page)}
        alt={`Trang ${page.page}`}
        className="block w-full h-auto"
        draggable={false}
      />

      <div className="absolute inset-0 pointer-events-none">
        {page.highlights.map((rect, index) => (
          <div
            key={`${page.page}-highlight-${index}`}
            className="absolute bg-yellow-300/45"
            style={{
              left: `${rect.x * 100}%`,
              top: `${rect.y * 100}%`,
              width: `${rect.width * 100}%`,
              height: `${rect.height * 100}%`,
            }}
          />
        ))}
      </div>

      <div className="absolute inset-0 select-text">
        {page.words.map((word, index) => (
          <span
            key={`${page.page}-${word.block}-${word.line}-${word.word}-${index}`}
            className="absolute text-transparent whitespace-nowrap cursor-text"
            style={{
              left: `${word.x * 100}%`,
              top: `${word.y * 100}%`,
              width: `${word.width * 100}%`,
              height: `${word.height * 100}%`,
              fontSize: `${Math.max(word.height * 100, 0.8)}cqw`,
              lineHeight: 1,
            }}
          >
            {word.text}
          </span>
        ))}
      </div>

      <div className="absolute top-2 right-2 pointer-events-none">
        <span className="px-2 py-1 rounded bg-black/65 text-white text-[10px] font-medium">
          Trang {page.page}
        </span>
      </div>
    </div>
  );
};

export const PdfViewer: React.FC<PdfViewerProps> = ({
  sourceId,
  bookTitle,
  initialPage,
  highlightText,
  highlightPages,
  onHighlightStatusChange,
}) => {
  const [pages, setPages] = useState<SourcePageView[]>([]);
  const [targetPdfPages, setTargetPdfPages] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!sourceId || !highlightPages.length || !highlightText.trim()) return;

      setIsLoading(true);
      setError(null);
      setPages([]);

      try {
        const result = await getEvidenceView(sourceId, highlightPages, highlightText);

        if (cancelled) return;

        setPages(result.pages || []);
        setTargetPdfPages(result.pdf_pages || []);
        onHighlightStatusChange?.(result.highlight_found);

        requestAnimationFrame(() => {
          const targetPage = result.pdf_pages?.[0];

          if (!targetPage) return;

          const element = containerRef.current?.querySelector(
            `[data-source-page="${targetPage}"]`
          );

          element?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        });
      } catch (err: any) {
        if (cancelled) return;

        console.error("Evidence source viewer failed:", err);
        setError(err?.message || "Không thể tải trang sử liệu.");
        onHighlightStatusChange?.(false);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [sourceId, initialPage, highlightText, highlightPages, onHighlightStatusChange]);

  if (isLoading) {
    return (
      <div className="grow min-h-[460px] flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-gray-50">
        <LoaderCircle className="w-7 h-7 animate-spin text-[var(--primary)]" />
        <p className="mt-3 text-xs font-serif font-semibold text-gray-700">
          Đang chuẩn bị các trang sử liệu...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="grow min-h-[460px] flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50/50 p-8 text-center">
        <AlertCircle className="w-8 h-8 text-[var(--primary)] mb-2" />
        <h4 className="font-serif font-bold text-sm text-gray-900">
          Không thể tải trang sử liệu
        </h4>
        <p className="text-xs text-gray-600 mt-1 max-w-md">{error}</p>
      </div>
    );
  }

  if (!pages.length) {
    return (
      <div className="grow min-h-[460px] flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-gray-50 p-8 text-center">
        <BookOpen className="w-7 h-7 text-gray-400 mb-2" />
        <p className="text-xs text-gray-500">Không có trang sử liệu để hiển thị.</p>
      </div>
    );
  }

  return (
    <div className="grow flex flex-col min-h-0 border border-gray-200 rounded-xl overflow-hidden bg-gray-100">
      <div className="px-3 py-2 bg-white border-b border-gray-200 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen className="w-4 h-4 text-[var(--primary)] flex-shrink-0" />
          <span className="text-xs font-serif font-semibold text-gray-800 truncate">
            {bookTitle || "Nguồn sử liệu"}
          </span>
        </div>

        {targetPdfPages.length > 0 && (
          <span className="text-[11px] text-gray-500 flex-shrink-0">
            Trang đối chiếu: {targetPdfPages.join(", ")}
          </span>
        )}
      </div>

      <div ref={containerRef} className="grow min-h-[460px] overflow-y-auto p-3 sm:p-4 space-y-4">
        {pages.map((page) => (
          <PageView
            key={page.page}
            sourceId={sourceId}
            page={page}
            isTarget={targetPdfPages.includes(page.page)}
          />
        ))}
      </div>
    </div>
  );
};