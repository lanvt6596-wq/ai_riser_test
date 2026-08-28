import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
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
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  } catch (e) {
    console.warn("Could not set PDF workerSrc:", e);
  }
}

interface PdfViewerProps {
  pdfUrl: string;
  bookTitle?: string;
  initialPage?: number;
  highlightText?: string;
  highlightPages?: number[];
  onHighlightStatusChange?: (found: boolean) => void;
}

interface PdfPageProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  highlightText?: string;
  shouldHighlight: boolean;
  shouldAutoScroll: boolean;
  onHighlightFound: () => void;
}

interface PageToken {
  value: string;
  divIndex: number;
}

const PAGE_WINDOW_SIZE = 5;

function tokenize(text: string): string[] {
  return (text || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\u00ad/g, "")
    .replace(/[‐-‒–—−]/g, "-")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function findSequence(haystack: string[], needle: string[]): number {
  if (!needle.length || needle.length > haystack.length) {
    return -1;
  }

  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) {
        continue outer;
      }
    }

    return i;
  }

  return -1;
}

function findMatchedDivIndexes(textItems: string[], evidenceText: string): Set<number> {
  const evidenceTokens = tokenize(evidenceText);

  if (evidenceTokens.length < 3) {
    return new Set();
  }

  const pageTokens: PageToken[] = [];

  textItems.forEach((text, divIndex) => {
    tokenize(text).forEach((value) => {
      pageTokens.push({ value, divIndex });
    });
  });

  const pageValues = pageTokens.map((token) => token.value);
  let matchStart = findSequence(pageValues, evidenceTokens);
  let matchLength = evidenceTokens.length;

  if (matchStart === -1) {
    const maxWindowSize = Math.min(18, evidenceTokens.length);

    for (let size = maxWindowSize; size >= 6 && matchStart === -1; size--) {
      for (let start = 0; start <= evidenceTokens.length - size; start++) {
        const window = evidenceTokens.slice(start, start + size);

        if (window.join("").length < 28) {
          continue;
        }

        const position = findSequence(pageValues, window);

        if (position !== -1) {
          matchStart = position;
          matchLength = size;
          break;
        }
      }
    }
  }

  if (matchStart === -1) {
    return new Set();
  }

  const matchedDivs = new Set<number>();

  for (let i = matchStart; i < matchStart + matchLength; i++) {
    matchedDivs.add(pageTokens[i].divIndex);
  }

  return matchedDivs;
}

function getPageWindow(centerPage: number, totalPages: number): number[] {
  if (totalPages <= PAGE_WINDOW_SIZE) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const half = Math.floor(PAGE_WINDOW_SIZE / 2);
  let start = Math.max(1, centerPage - half);
  let end = Math.min(totalPages, start + PAGE_WINDOW_SIZE - 1);

  if (end - start + 1 < PAGE_WINDOW_SIZE) {
    start = Math.max(1, end - PAGE_WINDOW_SIZE + 1);
  }

  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

const PdfPage: React.FC<PdfPageProps> = ({
  pdfDoc,
  pageNumber,
  scale,
  highlightText,
  shouldHighlight,
  shouldAutoScroll,
  onHighlightFound,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let renderTask: any = null;
    let textLayer: any = null;

    const render = async () => {
      if (!canvasRef.current || !textLayerRef.current || !pageRef.current) {
        return;
      }

      try {
        const page = await pdfDoc.getPage(pageNumber);

        if (cancelled) {
          return;
        }

        const viewport = page.getViewport({ scale });
        const pixelRatio = window.devicePixelRatio || 1;
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d", { alpha: false });

        if (!context) {
          return;
        }

        pageRef.current.style.width = `${viewport.width}px`;
        pageRef.current.style.height = `${viewport.height}px`;
        pageRef.current.style.setProperty("--total-scale-factor", String(scale));
        pageRef.current.style.setProperty("--scale-round-x", "1px");
        pageRef.current.style.setProperty("--scale-round-y", "1px");

        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        renderTask = page.render({
          canvasContext: context,
          viewport,
          transform: pixelRatio !== 1 ? [pixelRatio, 0, 0, pixelRatio, 0, 0] : undefined,
        });

        await renderTask.promise;

        if (cancelled) {
          return;
        }

        const textContent = await page.getTextContent();
        const textLayerDiv = textLayerRef.current;

        textLayerDiv.innerHTML = "";
        textLayerDiv.style.setProperty("--total-scale-factor", String(scale));
        textLayerDiv.style.setProperty("--scale-round-x", "1px");
        textLayerDiv.style.setProperty("--scale-round-y", "1px");

        textLayer = new pdfjsLib.TextLayer({
          textContentSource: textContent,
          container: textLayerDiv,
          viewport,
        });

        await textLayer.render();

        if (cancelled) {
          return;
        }

        let firstHighlight: HTMLElement | null = null;

        if (shouldHighlight && highlightText) {
          const matchedDivIndexes = findMatchedDivIndexes(
            textLayer.textContentItemsStr,
            highlightText,
          );

          matchedDivIndexes.forEach((index) => {
            const element = textLayer.textDivs[index] as HTMLElement | undefined;

            if (!element) {
              return;
            }

            element.classList.add("pdf-evidence-highlight");

            if (!firstHighlight) {
              firstHighlight = element;
            }
          });

          if (firstHighlight) {
            onHighlightFound();

            setTimeout(() => {
              firstHighlight?.scrollIntoView({
                behavior: "smooth",
                block: "center",
              });
            }, 100);

            return;
          }
        }

        if (shouldAutoScroll) {
          setTimeout(() => {
            pageRef.current?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          }, 100);
        }
      } catch (error: any) {
        if (error?.name !== "RenderingCancelledException") {
          console.error(`PDF page ${pageNumber} render error:`, error);
        }
      }
    };

    render();

    return () => {
      cancelled = true;

      try {
        renderTask?.cancel();
      } catch {}

      try {
        textLayer?.cancel();
      } catch {}
    };
  }, [
    pdfDoc,
    pageNumber,
    scale,
    highlightText,
    shouldHighlight,
    shouldAutoScroll,
    onHighlightFound,
  ]);

  return (
    <div
      ref={pageRef}
      data-pdf-page={pageNumber}
      className="pdf-page relative bg-white shadow-md border border-[#D5C9B3]"
    >
      <canvas ref={canvasRef} className="block absolute inset-0" />
      <div ref={textLayerRef} className="textLayer pdf-text-layer absolute inset-0" />

      <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 rounded bg-black/45 text-white text-[10px] pointer-events-none">
        {pageNumber}
      </div>
    </div>
  );
};

export const PdfViewer: React.FC<PdfViewerProps> = ({
  pdfUrl,
  bookTitle,
  initialPage = 1,
  highlightText,
  highlightPages = [],
  onHighlightStatusChange,
}) => {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [numPages, setNumPages] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.25);
  const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(true);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [highlightFound, setHighlightFound] = useState<boolean>(false);
  const [pageInputValue, setPageInputValue] = useState<string>(String(initialPage));

  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeLoadingTaskRef = useRef<any>(null);

  const validHighlightPages = useMemo(() => {
    if (!pdfDoc) {
      return [];
    }

    return highlightPages
      .filter((page) => page >= 1 && page <= pdfDoc.numPages)
      .map(Number);
  }, [highlightPages, pdfDoc]);

  const visiblePages = useMemo(() => {
    if (!pdfDoc) {
      return [];
    }

    const pages = new Set(getPageWindow(currentPage, pdfDoc.numPages));

    validHighlightPages.forEach((page) => pages.add(page));

    return Array.from(pages).sort((a, b) => a - b);
  }, [currentPage, pdfDoc, validHighlightPages]);

  useEffect(() => {
    if (!initialPage || initialPage < 1) {
      return;
    }

    const validPage = pdfDoc
      ? Math.max(1, Math.min(initialPage, pdfDoc.numPages))
      : initialPage;

    setCurrentPage(validPage);
    setPageInputValue(String(validPage));
  }, [initialPage, pdfDoc]);

  useEffect(() => {
    let cancelled = false;

    if (activeLoadingTaskRef.current) {
      try {
        activeLoadingTaskRef.current.destroy();
      } catch {}
    }

    setIsLoadingPdf(true);
    setPdfError(null);
    setPdfDoc(null);

    const loadingTask = pdfjsLib.getDocument({
      url: pdfUrl,
      cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/standard_fonts/`,
    });

    activeLoadingTaskRef.current = loadingTask;

    loadingTask.promise
      .then((doc) => {
        if (cancelled) {
          return;
        }

        const targetPage = Math.max(1, Math.min(initialPage || 1, doc.numPages));

        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setCurrentPage(targetPage);
        setPageInputValue(String(targetPage));
        setIsLoadingPdf(false);
      })
      .catch((error: any) => {
        if (cancelled) {
          return;
        }

        console.error("PDF load error:", error);
        setPdfError("Không thể tải tài liệu gốc. Vui lòng thử lại.");
        setIsLoadingPdf(false);
      });

    return () => {
      cancelled = true;

      try {
        loadingTask.destroy();
      } catch {}
    };
  }, [pdfUrl]);

  useEffect(() => {
    setHighlightFound(false);
  }, [pdfUrl, initialPage, highlightText, highlightPages]);

  useEffect(() => {
    onHighlightStatusChange?.(highlightFound);
  }, [highlightFound, onHighlightStatusChange]);

  const handleHighlightFound = useCallback(() => {
    setHighlightFound(true);
  }, []);

  const handlePrevPage = () => {
    if (currentPage <= 1) {
      return;
    }

    const page = currentPage - 1;

    setCurrentPage(page);
    setPageInputValue(String(page));
  };

  const handleNextPage = () => {
    if (!pdfDoc || currentPage >= pdfDoc.numPages) {
      return;
    }

    const page = currentPage + 1;

    setCurrentPage(page);
    setPageInputValue(String(page));
  };

  const handlePageInputCommit = () => {
    const page = parseInt(pageInputValue, 10);

    if (!pdfDoc || Number.isNaN(page) || page < 1 || page > pdfDoc.numPages) {
      setPageInputValue(String(currentPage));
      return;
    }

    setCurrentPage(page);
  };

  const handleZoomIn = () => setScale((value) => Math.min(value + 0.2, 2.5));
  const handleZoomOut = () => setScale((value) => Math.max(value - 0.2, 0.7));
  const handleResetZoom = () => setScale(1.25);

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

            <span className="text-[#7A7064]">/ {numPages || 1}</span>
          </div>

          <button
            type="button"
            onClick={handleNextPage}
            disabled={!pdfDoc || currentPage >= pdfDoc.numPages || isLoadingPdf}
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
            disabled={isLoadingPdf || scale <= 0.7}
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
          >
            Mặc định
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        aria-label={bookTitle || "PDF"}
        className="grow relative overflow-auto bg-[#524E48]/20 min-h-[480px] max-h-[75vh]"
      >
        {isLoadingPdf && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#FAF7F0]/90">
            <RefreshCw className="w-6 h-6 text-[#8B261E] animate-spin mb-2" />
            <p className="text-xs font-serif font-semibold text-[#1F1B18]">
              Đang mở toàn văn thư tịch...
            </p>
          </div>
        )}

        {pdfError && !isLoadingPdf && (
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

        {pdfDoc && !pdfError && (
          <div className="flex flex-col items-center gap-5 p-4 sm:p-6">
            {visiblePages.map((pageNumber) => (
              <PdfPage
                key={`${pdfUrl}:${pageNumber}:${scale}`}
                pdfDoc={pdfDoc}
                pageNumber={pageNumber}
                scale={scale}
                highlightText={highlightText}
                shouldHighlight={
                  validHighlightPages.length > 0
                    ? validHighlightPages.includes(pageNumber)
                    : pageNumber === initialPage
                }
                shouldAutoScroll={pageNumber === currentPage}
                onHighlightFound={handleHighlightFound}
              />
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-2 bg-[#F6F2E8] border-t border-[#E5DCB] flex items-center justify-between text-[11px] text-[#7A7064]">
        <span>Đang hiển thị các trang xung quanh vị trí trích dẫn</span>
        <span className="font-serif italic hidden sm:inline">Văn bản PDF thư tịch</span>
      </div>
    </div>
  );
};