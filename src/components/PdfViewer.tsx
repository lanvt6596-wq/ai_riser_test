import React, { useCallback, useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import * as pdfjsViewer from "pdfjs-dist/web/pdf_viewer.mjs";
import "pdfjs-dist/web/pdf_viewer.css";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  FileText,
  RefreshCw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

if (typeof window !== "undefined" && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

interface PdfViewerProps {
  pdfUrl: string;
  bookTitle?: string;
  initialPage?: number;
  highlightText?: string;
  onHighlightStatusChange?: (found: boolean) => void;
}

function buildSearchQuery(text: string): string {
  const normalized = (text || "")
    .normalize("NFC")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return "";

  const sentenceMatch = normalized.match(/^.*?[.!?](?:\s|$)/);
  const sentence = sentenceMatch?.[0]?.trim() || normalized;

  if (sentence.length <= 180) return sentence;

  const shortened = sentence.slice(0, 180);
  const lastSpace = shortened.lastIndexOf(" ");

  return lastSpace > 80 ? shortened.slice(0, lastSpace) : shortened;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({
  pdfUrl,
  bookTitle,
  initialPage = 1,
  highlightText,
  onHighlightStatusChange,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerElementRef = useRef<HTMLDivElement | null>(null);
  const pdfViewerRef = useRef<any>(null);
  const eventBusRef = useRef<any>(null);
  const findControllerRef = useRef<any>(null);
  const linkServiceRef = useRef<any>(null);
  const loadingTaskRef = useRef<any>(null);
  const pdfDocumentRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageInputValue, setPageInputValue] = useState(String(initialPage));
  const [numPages, setNumPages] = useState(1);
  const [scale, setScale] = useState(1);
  const [isLoadingPdf, setIsLoadingPdf] = useState(true);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [viewerReady, setViewerReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !viewerElementRef.current) return;

    const eventBus = new pdfjsViewer.EventBus();
    const linkService = new pdfjsViewer.PDFLinkService({ eventBus });
    const findController = new pdfjsViewer.PDFFindController({
      eventBus,
      linkService,
    });

    const pdfViewer = new pdfjsViewer.PDFViewer({
      container: containerRef.current,
      eventBus,
      linkService,
      findController,
      removePageBorders: false,
    });

    linkService.setViewer(pdfViewer);

    const handlePagesInit = () => {
      pdfViewer.currentScaleValue = "page-width";
      setScale(pdfViewer.currentScale);
      setViewerReady(true);
      setIsLoadingPdf(false);
    };

    const handlePageChanging = (event: any) => {
      setCurrentPage(event.pageNumber);
      setPageInputValue(String(event.pageNumber));
    };

    const handleScaleChanging = (event: any) => {
      setScale(event.scale);
    };

    const handleFindMatches = (event: any) => {
      const total = event.matchesCount?.total || 0;
      onHighlightStatusChange?.(total > 0);

      if (total > 0 && pdfViewerRef.current) {
        const page = Math.max(1, Math.min(initialPage, pdfDocumentRef.current?.numPages || 1));
        window.setTimeout(() => {
          if (pdfViewerRef.current) pdfViewerRef.current.currentPageNumber = page;
        }, 100);
      }
    };

    eventBus.on("pagesinit", handlePagesInit);
    eventBus.on("pagechanging", handlePageChanging);
    eventBus.on("scalechanging", handleScaleChanging);
    eventBus.on("updatefindmatchescount", handleFindMatches);

    eventBusRef.current = eventBus;
    linkServiceRef.current = linkService;
    findControllerRef.current = findController;
    pdfViewerRef.current = pdfViewer;

    return () => {
      eventBus.off("pagesinit", handlePagesInit);
      eventBus.off("pagechanging", handlePageChanging);
      eventBus.off("scalechanging", handleScaleChanging);
      eventBus.off("updatefindmatchescount", handleFindMatches);

      pdfViewer.setDocument(null);
      linkService.setDocument(null, null);

      pdfViewerRef.current = null;
      eventBusRef.current = null;
      findControllerRef.current = null;
      linkServiceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!pdfViewerRef.current || !linkServiceRef.current) return;

    let cancelled = false;

    setIsLoadingPdf(true);
    setPdfError(null);
    setViewerReady(false);
    onHighlightStatusChange?.(false);

    if (loadingTaskRef.current) {
      try {
        loadingTaskRef.current.destroy();
      } catch {}
    }

    if (pdfDocumentRef.current) {
      try {
        pdfDocumentRef.current.destroy();
      } catch {}

      pdfDocumentRef.current = null;
    }

    const loadingTask = pdfjsLib.getDocument({
      url: pdfUrl,
      cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/standard_fonts/`,
    });

    loadingTaskRef.current = loadingTask;

    loadingTask.promise
      .then((pdfDocument) => {
        if (cancelled) return;

        pdfDocumentRef.current = pdfDocument;
        setNumPages(pdfDocument.numPages);

        const page = Math.max(1, Math.min(initialPage, pdfDocument.numPages));
        setCurrentPage(page);
        setPageInputValue(String(page));

        pdfViewerRef.current.setDocument(pdfDocument);
        linkServiceRef.current.setDocument(pdfDocument, null);
      })
      .catch((error: any) => {
        if (cancelled) return;

        console.error("PDF load error:", error);
        setPdfError("Không thể tải tài liệu gốc. Vui lòng thử lại.");
        setIsLoadingPdf(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pdfUrl]);

  useEffect(() => {
    if (!viewerReady || !pdfViewerRef.current || !pdfDocumentRef.current) return;

    const page = Math.max(1, Math.min(initialPage, pdfDocumentRef.current.numPages));

    pdfViewerRef.current.currentPageNumber = page;
    setCurrentPage(page);
    setPageInputValue(String(page));
  }, [initialPage, viewerReady]);

  useEffect(() => {
    if (!viewerReady || !eventBusRef.current || !pdfViewerRef.current) return;

    const query = buildSearchQuery(highlightText || "");

    eventBusRef.current.dispatch("find", {
      source: pdfViewerRef.current,
      type: "",
      query: "",
      phraseSearch: true,
      caseSensitive: false,
      entireWord: false,
      highlightAll: true,
      findPrevious: false,
    });

    onHighlightStatusChange?.(false);

    if (!query) return;

    const page = Math.max(1, Math.min(initialPage, pdfDocumentRef.current?.numPages || 1));
    pdfViewerRef.current.currentPageNumber = page;

    const timer = window.setTimeout(() => {
      if (!eventBusRef.current || !pdfViewerRef.current) return;

      eventBusRef.current.dispatch("find", {
        source: pdfViewerRef.current,
        type: "",
        query,
        phraseSearch: true,
        caseSensitive: false,
        entireWord: false,
        highlightAll: true,
        findPrevious: false,
      });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [highlightText, initialPage, viewerReady]);

  const goToPage = useCallback((page: number) => {
    if (!pdfViewerRef.current || !pdfDocumentRef.current) return;

    const safePage = Math.max(1, Math.min(page, pdfDocumentRef.current.numPages));

    pdfViewerRef.current.currentPageNumber = safePage;
    setCurrentPage(safePage);
    setPageInputValue(String(safePage));
  }, []);

  const handlePrevPage = () => goToPage(currentPage - 1);
  const handleNextPage = () => goToPage(currentPage + 1);

  const handlePageInputCommit = () => {
    const page = Number.parseInt(pageInputValue, 10);

    if (!Number.isFinite(page) || page < 1 || page > numPages) {
      setPageInputValue(String(currentPage));
      return;
    }

    goToPage(page);
  };

  const handleZoomIn = () => {
    const viewer = pdfViewerRef.current;

    if (!viewer) return;

    viewer.currentScale = Math.min(viewer.currentScale * 1.15, 2.5);
  };

  const handleZoomOut = () => {
    const viewer = pdfViewerRef.current;

    if (!viewer) return;

    viewer.currentScale = Math.max(viewer.currentScale / 1.15, 0.5);
  };

  const handleResetZoom = () => {
    const viewer = pdfViewerRef.current;

    if (!viewer) return;

    viewer.currentScaleValue = "page-width";
  };

  return (
    <div className="flex flex-col h-full bg-[#FAF7F0] border border-[#E3DAC8] rounded-xl overflow-hidden shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2.5 bg-[#F4EFE5] border-b border-[#E3DAC8] text-xs text-[#4A4036] select-none">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handlePrevPage}
            disabled={currentPage <= 1 || isLoadingPdf}
            className="p-1.5 rounded hover:bg-[#E7DFC8] disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Trang trước"
          >
            <ChevronLeft className="w-4 h-4 text-[#2C2723]" />
          </button>

          <div className="flex items-center gap-1 font-mono text-xs">
            <span>Trang</span>
            <input
              type="text"
              value={pageInputValue}
              onChange={(event) => setPageInputValue(event.target.value)}
              onBlur={handlePageInputCommit}
              onKeyDown={(event) => event.key === "Enter" && handlePageInputCommit()}
              disabled={isLoadingPdf}
              className="w-11 px-1.5 py-0.5 text-center bg-[#FCFBF8] border border-[#D5C9B3] rounded font-semibold text-[#1F1B18] focus:outline-hidden focus:border-[#8B261E]"
            />
            <span className="text-[#7A7064]">/ {numPages}</span>
          </div>

          <button
            type="button"
            onClick={handleNextPage}
            disabled={currentPage >= numPages || isLoadingPdf}
            className="p-1.5 rounded hover:bg-[#E7DFC8] disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Trang sau"
          >
            <ChevronRight className="w-4 h-4 text-[#2C2723]" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={isLoadingPdf || scale <= 0.5}
            className="p-1.5 rounded hover:bg-[#E7DFC8] disabled:opacity-35 transition-colors cursor-pointer"
            title="Thu nhỏ"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <span className="font-mono text-[11px] text-[#6B6156] min-w-[38px] text-center">
            {Math.round(scale * 100)}%
          </span>

          <button
            type="button"
            onClick={handleZoomIn}
            disabled={isLoadingPdf || scale >= 2.5}
            className="p-1.5 rounded hover:bg-[#E7DFC8] disabled:opacity-35 transition-colors cursor-pointer"
            title="Phóng to"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleResetZoom}
            disabled={isLoadingPdf}
            className="p-1.5 rounded hover:bg-[#E7DFC8] text-[11px] font-medium text-[#5E544B] transition-colors cursor-pointer hidden sm:inline-block"
            title="Vừa chiều rộng"
          >
            Mặc định
          </button>
        </div>
      </div>

      <div className="grow relative min-h-[480px] max-h-[75vh]">
        <div
          ref={containerRef}
          aria-label={bookTitle || "PDF"}
          className="pdf-viewer-container absolute inset-0 overflow-auto bg-[#524E48]/20"
        >
          <div ref={viewerElementRef} className="pdfViewer" />
        </div>

        {isLoadingPdf && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#FAF7F0]/90">
            <RefreshCw className="w-6 h-6 text-[#8B261E] animate-spin mb-2" />
            <p className="text-xs font-serif font-semibold text-[#1F1B18]">
              Đang mở toàn văn thư tịch...
            </p>
          </div>
        )}

        {pdfError && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 bg-[#FAF7F0]/95 text-center">
            <AlertCircle className="w-6 h-6 text-[#8B261E] mb-2" />
            <p className="text-sm font-serif font-semibold text-[#1F1B18] mb-3">
              {pdfError}
            </p>

            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-[#8B261E] text-white text-xs font-medium"
            >
              <FileText className="w-3.5 h-3.5" />
              Mở tệp trong tab mới
            </a>
          </div>
        )}
      </div>

      <div className="px-4 py-2 bg-[#F6F2E8] border-t border-[#E3DAC8] flex items-center justify-between text-[11px] text-[#7A7064]">
        <span>Cuộn để đọc toàn bộ thư tịch</span>
        <span className="font-serif italic hidden sm:inline">Văn bản PDF thư tịch</span>
      </div>
    </div>
  );
};