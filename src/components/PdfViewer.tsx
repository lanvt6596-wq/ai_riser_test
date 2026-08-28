import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, Copy, RefreshCw, ZoomIn, ZoomOut } from "lucide-react";

import { getEvidenceView, getSourcePageImageUrl } from "../services/pdfService";
import type { SourcePageView } from "../types";

interface PdfViewerProps {
  sourceId: string;
  bookTitle?: string;
  initialPage?: number;
  highlightText?: string;
  highlightPages?: number[];
  onHighlightStatusChange?: (found: boolean) => void;
}

interface SourcePageProps {
  sourceId: string;
  page: SourcePageView;
  scale: number;
  active: boolean;
}

const SourcePage: React.FC<SourcePageProps> = ({ sourceId, page, scale, active }) => {
  return (
    <div
      data-source-page={page.page}
      className={`relative shrink-0 bg-white border shadow-md ${active ? "border-[#8B261E]" : "border-[#D5C9B3]"}`}
      style={{ width: `${scale * 100}%`, maxWidth: `${900 * scale}px` }}
    >
      <img
        src={getSourcePageImageUrl(sourceId, page.page)}
        alt={`Trang ${page.page}`}
        draggable={false}
        className="block w-full h-auto select-none"
      />

      <div className="absolute inset-0 pointer-events-none z-10">
        {page.highlights.map((rect, index) => (
          <div
            key={index}
            className="absolute rounded-[2px]"
            style={{
              left: `${rect.x * 100}%`,
              top: `${rect.y * 100}%`,
              width: `${rect.width * 100}%`,
              height: `${rect.height * 100}%`,
              backgroundColor: "rgba(250, 204, 21, 0.34)",
              boxShadow: "inset 0 -1px 0 rgba(161, 98, 7, 0.28)",
            }}
          />
        ))}
      </div>

      <div className="absolute inset-0 z-20 overflow-hidden">
        {page.words.map((word, index) => (
          <span
            key={`${word.block}-${word.line}-${word.word}-${index}`}
            className="absolute text-transparent select-text whitespace-pre overflow-hidden"
            style={{
              left: `${word.x * 100}%`,
              top: `${word.y * 100}%`,
              width: `${word.width * 100}%`,
              height: `${word.height * 100}%`,
              fontSize: `${Math.max(word.height * 100, 0.5)}cqw`,
              lineHeight: 1,
              cursor: "text",
            }}
          >
            {word.text}{" "}
          </span>
        ))}
      </div>

      <div className="absolute top-2 right-2 z-30 px-1.5 py-0.5 rounded bg-black/50 text-white text-[10px] pointer-events-none">
        {page.page}
      </div>
    </div>
  );
};

export const PdfViewer: React.FC<PdfViewerProps> = ({
  sourceId,
  bookTitle,
  initialPage = 1,
  highlightText = "",
  highlightPages = [],
  onHighlightStatusChange,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [pages, setPages] = useState<SourcePageView[]>([]);
  const [pdfPages, setPdfPages] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageInput, setPageInput] = useState(String(initialPage));
  const [scale, setScale] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const evidencePages = useMemo(() => {
    return [...new Set(highlightPages.length ? highlightPages : [initialPage])].sort((a, b) => a - b);
  }, [highlightPages, initialPage]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await getEvidenceView(sourceId, evidencePages, highlightText);

        if (cancelled) return;

        setPages(result.pages);
        setPdfPages(result.pdf_pages);

        const firstPage = result.pdf_pages[0] || result.display_pages[0];

        setCurrentPage(firstPage);
        setPageInput(String(firstPage));
        onHighlightStatusChange?.(result.highlight_found);

        window.setTimeout(() => scrollToPage(firstPage, "auto"), 100);
      } catch (err) {
        if (cancelled) return;

        console.error("Evidence source viewer failed:", err);
        setError("Không thể tải trang sử liệu.");
        onHighlightStatusChange?.(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [sourceId, evidencePages, highlightText, onHighlightStatusChange]);

  const scrollToPage = (page: number, behavior: ScrollBehavior = "smooth") => {
    const element = containerRef.current?.querySelector(`[data-source-page="${page}"]`);
    element?.scrollIntoView({ behavior, block: "center" });
  };

  const goToPage = (page: number) => {
    if (!pages.length) return;

    const first = pages[0].page;
    const last = pages[pages.length - 1].page;
    const target = Math.max(first, Math.min(page, last));

    setCurrentPage(target);
    setPageInput(String(target));
    scrollToPage(target);
  };

  const commitPageInput = () => {
    const value = Number.parseInt(pageInput, 10);

    if (!Number.isFinite(value)) {
      setPageInput(String(currentPage));
      return;
    }

    goToPage(value);
  };

  const handleScroll = () => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const center = containerRect.top + containerRect.height / 2;
    const elements = Array.from(container.querySelectorAll<HTMLElement>("[data-source-page]"));

    let nearest = currentPage;
    let distance = Number.POSITIVE_INFINITY;

    elements.forEach((element) => {
      const rect = element.getBoundingClientRect();
      const currentDistance = Math.abs(rect.top + rect.height / 2 - center);

      if (currentDistance < distance) {
        distance = currentDistance;
        nearest = Number(element.dataset.sourcePage);
      }
    });

    if (nearest !== currentPage) {
      setCurrentPage(nearest);
      setPageInput(String(nearest));
    }
  };

  const copyEvidence = async () => {
    if (!highlightText.trim()) return;

    try {
      await navigator.clipboard.writeText(highlightText);
    } catch (error) {
      console.error("Copy evidence failed:", error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#FAF7F0] border border-[#E3DAC8] rounded-xl overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 bg-[#F4EFE5] border-b border-[#E3DAC8] text-xs text-[#4A4036]">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => goToPage(currentPage - 1)} className="p-1.5 rounded hover:bg-[#E7DFC8] cursor-pointer">
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span>Trang</span>

          <input
            value={pageInput}
            onChange={(event) => setPageInput(event.target.value)}
            onBlur={commitPageInput}
            onKeyDown={(event) => event.key === "Enter" && commitPageInput()}
            className="w-12 px-1.5 py-0.5 text-center bg-white border border-[#D5C9B3] rounded font-semibold"
          />

          <button type="button" onClick={() => goToPage(currentPage + 1)} className="p-1.5 rounded hover:bg-[#E7DFC8] cursor-pointer">
            <ChevronRight className="w-4 h-4" />
          </button>

          {pdfPages.length > 0 && (
            <span className="ml-2 text-[#7A7064]">
              Nguồn: {pdfPages.join(", ")}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setScale((value) => Math.max(0.7, value - 0.1))} className="p-1.5 rounded hover:bg-[#E7DFC8] cursor-pointer">
            <ZoomOut className="w-4 h-4" />
          </button>

          <span className="min-w-[38px] text-center font-mono">{Math.round(scale * 100)}%</span>

          <button type="button" onClick={() => setScale((value) => Math.min(1.5, value + 0.1))} className="p-1.5 rounded hover:bg-[#E7DFC8] cursor-pointer">
            <ZoomIn className="w-4 h-4" />
          </button>

          <button type="button" onClick={copyEvidence} className="p-1.5 rounded hover:bg-[#E7DFC8] cursor-pointer" title="Sao chép đoạn sử liệu">
            <Copy className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        onScroll={handleScroll}
        aria-label={bookTitle || "Nguồn sử liệu"}
        className="grow relative overflow-auto bg-[#524E48]/20 min-h-[480px] max-h-[75vh]"
      >
        {loading && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#FAF7F0]/95">
            <RefreshCw className="w-6 h-6 text-[#8B261E] animate-spin mb-2" />
            <span className="text-xs">Đang mở trang sử liệu...</span>
          </div>
        )}

        {error && !loading && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#FAF7F0] text-center">
            <AlertCircle className="w-6 h-6 text-[#8B261E] mb-2" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {!loading && !error && (
          <div className="flex flex-col items-center gap-5 p-4 sm:p-6">
            {pages.map((page) => (
              <SourcePage
                key={page.page}
                sourceId={sourceId}
                page={page}
                scale={scale}
                active={page.page === currentPage}
              />
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-2 bg-[#F6F2E8] border-t border-[#E3DAC8] flex items-center justify-between text-[11px] text-[#7A7064]">
        <span>Có thể chọn và sao chép văn bản trực tiếp trên trang</span>
        <span className="hidden sm:inline">Hiển thị 3 trang trước và sau nguồn trích dẫn</span>
      </div>
    </div>
  );
};