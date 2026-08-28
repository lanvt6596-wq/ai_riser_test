import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { AlertCircle, ChevronLeft, ChevronRight, FileText, RefreshCw, ZoomIn, ZoomOut } from "lucide-react";

if (typeof window !== "undefined" && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

interface PdfViewerProps {
  pdfUrl: string;
  bookTitle?: string;
  initialPage?: number;
  highlightText?: string;
  highlightPages?: number[];
  onHighlightStatusChange?: (found: boolean) => void;
}

interface TextItemData {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

interface TokenRef {
  value: string;
  pageNumber: number;
  itemIndex: number;
}

interface HighlightRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface PdfPageProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  highlightedItems?: Set<number>;
}

const CONTEXT_PAGES = 3;

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

function getTextItems(textContent: any): TextItemData[] {
  return textContent.items.filter((item: any) => typeof item.str === "string" && Array.isArray(item.transform));
}

function findExactSequence(source: string[], target: string[]): number {
  if (!target.length || target.length > source.length) return -1;

  outer: for (let i = 0; i <= source.length - target.length; i++) {
    for (let j = 0; j < target.length; j++) {
      if (source[i + j] !== target[j]) continue outer;
    }

    return i;
  }

  return -1;
}

function findLongestCommonRun(source: string[], target: string[]): { start: number; length: number } {
  if (!source.length || !target.length) return { start: -1, length: 0 };

  let previous = new Uint16Array(target.length + 1);
  let bestLength = 0;
  let bestEnd = 0;

  for (let i = 1; i <= source.length; i++) {
    const current = new Uint16Array(target.length + 1);

    for (let j = 1; j <= target.length; j++) {
      if (source[i - 1] !== target[j - 1]) continue;

      current[j] = previous[j - 1] + 1;

      if (current[j] > bestLength) {
        bestLength = current[j];
        bestEnd = i;
      }
    }

    previous = current;
  }

  return {
    start: bestLength > 0 ? bestEnd - bestLength : -1,
    length: bestLength,
  };
}

function createHighlightMap(tokens: TokenRef[], evidenceText: string): Map<number, Set<number>> {
  const evidenceTokens = tokenize(evidenceText);
  const pageTokens = tokens.map((token) => token.value);

  if (!evidenceTokens.length || !pageTokens.length) return new Map();

  let matchStart = findExactSequence(pageTokens, evidenceTokens);
  let matchLength = evidenceTokens.length;

  if (matchStart === -1) {
    const fallback = findLongestCommonRun(pageTokens, evidenceTokens);
    const matchedText = fallback.start >= 0
      ? pageTokens.slice(fallback.start, fallback.start + fallback.length).join(" ")
      : "";

    if (fallback.length < 8 || matchedText.length < 40) return new Map();

    matchStart = fallback.start;
    matchLength = fallback.length;
  }

  const result = new Map<number, Set<number>>();

  for (let i = matchStart; i < matchStart + matchLength; i++) {
    const token = tokens[i];

    if (!result.has(token.pageNumber)) result.set(token.pageNumber, new Set());
    result.get(token.pageNumber)!.add(token.itemIndex);
  }

  return result;
}

function buildSourceWindow(sourcePages: number[], numPages: number): number[] {
  const validPages = sourcePages.filter((page) => page >= 1 && page <= numPages).sort((a, b) => a - b);
  const firstPage = validPages[0] || 1;
  const lastPage = validPages[validPages.length - 1] || firstPage;
  const start = Math.max(1, firstPage - CONTEXT_PAGES);
  const end = Math.min(numPages, lastPage + CONTEXT_PAGES);

  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function buildPageWindow(pageNumber: number, numPages: number): number[] {
  const start = Math.max(1, pageNumber - CONTEXT_PAGES);
  const end = Math.min(numPages, pageNumber + CONTEXT_PAGES);

  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function mergeRects(rects: HighlightRect[]): HighlightRect[] {
  if (rects.length < 2) return rects;

  const result: HighlightRect[] = [];

  for (const rect of rects) {
    const previous = result[result.length - 1];

    if (
      previous &&
      Math.abs(previous.top - rect.top) <= Math.max(previous.height, rect.height) * 0.45 &&
      rect.left - (previous.left + previous.width) <= 8
    ) {
      const right = Math.max(previous.left + previous.width, rect.left + rect.width);
      previous.width = right - previous.left;
      previous.top = Math.min(previous.top, rect.top);
      previous.height = Math.max(previous.height, rect.height);
      continue;
    }

    result.push({ ...rect });
  }

  return result;
}

const PdfPage: React.FC<PdfPageProps> = ({ pdfDoc, pageNumber, scale, highlightedItems }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const [highlightRects, setHighlightRects] = useState<HighlightRect[]>([]);

  useEffect(() => {
    let cancelled = false;
    let renderTask: any = null;

    const renderPage = async () => {
      const canvas = canvasRef.current;

      if (!canvas) return;

      try {
        const page = await pdfDoc.getPage(pageNumber);

        if (cancelled) return;

        const viewport = page.getViewport({ scale });
        const outputScale = window.devicePixelRatio || 1;
        const context = canvas.getContext("2d", { alpha: false });

        if (!context) return;

        setPageSize({ width: viewport.width, height: viewport.height });

        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        renderTask = page.render({
          canvasContext: context,
          viewport,
          transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined,
        });

        await renderTask.promise;

        if (cancelled || !highlightedItems?.size) {
          setHighlightRects([]);
          return;
        }

        const textContent = await page.getTextContent();

        if (cancelled) return;

        const items = getTextItems(textContent);
        const rects: HighlightRect[] = [];

        highlightedItems.forEach((itemIndex) => {
          const item = items[itemIndex];

          if (!item) return;

          const transform = pdfjsLib.Util.transform(viewport.transform, item.transform);
          const fontHeight = Math.max(Math.hypot(transform[2], transform[3]), 2);
          const width = Math.max(Math.abs(item.width * viewport.scale), 2);

          rects.push({
            left: transform[4],
            top: transform[5] - fontHeight,
            width,
            height: fontHeight * 1.08,
          });
        });

        setHighlightRects(mergeRects(rects));
      } catch (error: any) {
        if (error?.name !== "RenderingCancelledException") {
          console.error(`PDF page ${pageNumber} render error:`, error);
        }
      }
    };

    renderPage();

    return () => {
      cancelled = true;

      try {
        renderTask?.cancel();
      } catch {}
    };
  }, [pdfDoc, pageNumber, scale, highlightedItems]);

  return (
    <div
      data-pdf-page={pageNumber}
      className="relative bg-white border border-[#D5C9B3] shadow-md"
      style={{ width: pageSize.width || undefined, height: pageSize.height || undefined }}
    >
      <canvas ref={canvasRef} className="block" />

      <div className="absolute inset-0 pointer-events-none">
        {highlightRects.map((rect, index) => (
          <div
            key={`${pageNumber}-${index}`}
            className="absolute rounded-[2px]"
            style={{
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
              backgroundColor: "rgba(250, 204, 21, 0.32)",
              boxShadow: "inset 0 -1px 0 rgba(161, 98, 7, 0.28)",
            }}
          />
        ))}
      </div>

      <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/45 text-white text-[10px] pointer-events-none">
        {pageNumber}
      </div>
    </div>
  );
};

export const PdfViewer: React.FC<PdfViewerProps> = ({
  pdfUrl,
  bookTitle,
  initialPage = 1,
  highlightText = "",
  highlightPages = [],
  onHighlightStatusChange,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const loadingTaskRef = useRef<any>(null);
  const scrollFrameRef = useRef<number | null>(null);

  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageInputValue, setPageInputValue] = useState(String(initialPage));
  const [scale, setScale] = useState(1.1);
  const [visiblePages, setVisiblePages] = useState<number[]>([]);
  const [highlightMap, setHighlightMap] = useState<Map<number, Set<number>>>(new Map());
  const [isLoadingPdf, setIsLoadingPdf] = useState(true);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const sourcePages = useMemo(() => {
    const pages = highlightPages.length > 0 ? highlightPages : [initialPage];

    return [...new Set(pages)].sort((a, b) => a - b);
  }, [highlightPages, initialPage]);

  const scrollToPage = useCallback((pageNumber: number, behavior: ScrollBehavior = "smooth") => {
    window.setTimeout(() => {
      const element = containerRef.current?.querySelector(`[data-pdf-page="${pageNumber}"]`);
      element?.scrollIntoView({ behavior, block: "start" });
    }, 100);
  }, []);

  useEffect(() => {
    let cancelled = false;

    setPdfDoc(null);
    setPdfError(null);
    setIsLoadingPdf(true);
    setHighlightMap(new Map());
    onHighlightStatusChange?.(false);

    if (loadingTaskRef.current) {
      try {
        loadingTaskRef.current.destroy();
      } catch {}
    }

    const loadingTask = pdfjsLib.getDocument({
      url: pdfUrl,
      cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/standard_fonts/`,
    });

    loadingTaskRef.current = loadingTask;

    loadingTask.promise
      .then((document) => {
        if (cancelled) return;

        const targetPage = Math.max(1, Math.min(initialPage, document.numPages));

        setPdfDoc(document);
        setNumPages(document.numPages);
        setCurrentPage(targetPage);
        setPageInputValue(String(targetPage));
        setVisiblePages(buildSourceWindow(sourcePages, document.numPages));
        setIsLoadingPdf(false);
        scrollToPage(targetPage, "auto");
      })
      .catch((error) => {
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
    if (!pdfDoc) return;

    const targetPage = Math.max(1, Math.min(initialPage, pdfDoc.numPages));

    setCurrentPage(targetPage);
    setPageInputValue(String(targetPage));
    setVisiblePages(buildSourceWindow(sourcePages, pdfDoc.numPages));
    scrollToPage(targetPage);
  }, [initialPage, pdfDoc, sourcePages, scrollToPage]);

  useEffect(() => {
    if (!pdfDoc || !highlightText.trim()) {
      setHighlightMap(new Map());
      onHighlightStatusChange?.(false);
      return;
    }

    let cancelled = false;

    const findEvidence = async () => {
      try {
        const validPages = sourcePages.filter((page) => page >= 1 && page <= pdfDoc.numPages);
        const tokens: TokenRef[] = [];

        for (const pageNumber of validPages) {
          const page = await pdfDoc.getPage(pageNumber);
          const textContent = await page.getTextContent();

          if (cancelled) return;

          const items = getTextItems(textContent);

          items.forEach((item, itemIndex) => {
            tokenize(item.str).forEach((value) => {
              tokens.push({ value, pageNumber, itemIndex });
            });
          });
        }

        const result = createHighlightMap(tokens, highlightText);

        if (cancelled) return;

        setHighlightMap(result);
        onHighlightStatusChange?.(result.size > 0);

        if (result.size > 0) {
          const firstMatchedPage = [...result.keys()].sort((a, b) => a - b)[0];
          scrollToPage(firstMatchedPage);
        }
      } catch (error) {
        if (cancelled) return;

        console.error("Evidence matching failed:", error);
        setHighlightMap(new Map());
        onHighlightStatusChange?.(false);
      }
    };

    findEvidence();

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, highlightText, sourcePages, onHighlightStatusChange, scrollToPage]);

  const goToPage = (pageNumber: number) => {
    if (!pdfDoc) return;

    const targetPage = Math.max(1, Math.min(pageNumber, pdfDoc.numPages));

    if (!visiblePages.includes(targetPage)) {
      setVisiblePages(buildPageWindow(targetPage, pdfDoc.numPages));
    }

    setCurrentPage(targetPage);
    setPageInputValue(String(targetPage));
    scrollToPage(targetPage);
  };

  const handleScroll = () => {
    if (!containerRef.current || scrollFrameRef.current !== null) return;

    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollFrameRef.current = null;

      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const center = containerRect.top + containerRect.height * 0.35;
      const pages = Array.from(containerRef.current.querySelectorAll<HTMLElement>("[data-pdf-page]"));

      let nearestPage = currentPage;
      let nearestDistance = Number.POSITIVE_INFINITY;

      pages.forEach((element) => {
        const rect = element.getBoundingClientRect();
        const pageCenter = rect.top + rect.height / 2;
        const distance = Math.abs(pageCenter - center);

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestPage = Number(element.dataset.pdfPage);
        }
      });

      if (nearestPage !== currentPage) {
        setCurrentPage(nearestPage);
        setPageInputValue(String(nearestPage));
      }
    });
  };

  const handlePageInputCommit = () => {
    const pageNumber = Number.parseInt(pageInputValue, 10);

    if (!Number.isFinite(pageNumber) || pageNumber < 1 || pageNumber > numPages) {
      setPageInputValue(String(currentPage));
      return;
    }

    goToPage(pageNumber);
  };

  const handleZoomIn = () => setScale((value) => Math.min(value + 0.15, 2.2));
  const handleZoomOut = () => setScale((value) => Math.max(value - 0.15, 0.65));
  const handleResetZoom = () => setScale(1.1);

  return (
    <div className="flex flex-col h-full bg-[#FAF7F0] border border-[#E3DAC8] rounded-xl overflow-hidden shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2.5 bg-[#F4EFE5] border-b border-[#E3DAC8] text-xs text-[#4A4036] select-none">
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1 || isLoadingPdf} className="p-1.5 rounded hover:bg-[#E7DFC8] disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer" title="Trang trước">
            <ChevronLeft className="w-4 h-4" />
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

          <button type="button" onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= numPages || isLoadingPdf} className="p-1.5 rounded hover:bg-[#E7DFC8] disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer" title="Trang sau">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button type="button" onClick={handleZoomOut} disabled={isLoadingPdf || scale <= 0.65} className="p-1.5 rounded hover:bg-[#E7DFC8] disabled:opacity-35 cursor-pointer" title="Thu nhỏ">
            <ZoomOut className="w-4 h-4" />
          </button>

          <span className="font-mono text-[11px] text-[#6B6156] min-w-[38px] text-center">{Math.round(scale * 100)}%</span>

          <button type="button" onClick={handleZoomIn} disabled={isLoadingPdf || scale >= 2.2} className="p-1.5 rounded hover:bg-[#E7DFC8] disabled:opacity-35 cursor-pointer" title="Phóng to">
            <ZoomIn className="w-4 h-4" />
          </button>

          <button type="button" onClick={handleResetZoom} disabled={isLoadingPdf} className="p-1.5 rounded hover:bg-[#E7DFC8] text-[11px] font-medium text-[#5E544B] cursor-pointer hidden sm:inline-block">
            Mặc định
          </button>
        </div>
      </div>

      <div ref={containerRef} onScroll={handleScroll} aria-label={bookTitle || "PDF"} className="grow relative overflow-auto bg-[#524E48]/20 min-h-[480px] max-h-[75vh]">
        {isLoadingPdf && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#FAF7F0]/90">
            <RefreshCw className="w-6 h-6 text-[#8B261E] animate-spin mb-2" />
            <p className="text-xs font-serif font-semibold text-[#1F1B18]">Đang mở toàn văn thư tịch...</p>
          </div>
        )}

        {pdfError && !isLoadingPdf && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 bg-[#FAF7F0]/95 text-center">
            <AlertCircle className="w-6 h-6 text-[#8B261E] mb-2" />
            <p className="text-sm font-serif font-semibold text-[#1F1B18] mb-3">{pdfError}</p>
            <a href={pdfUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-[#8B261E] text-white text-xs font-medium">
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
                highlightedItems={highlightMap.get(pageNumber)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-2 bg-[#F6F2E8] border-t border-[#E3DAC8] flex items-center justify-between text-[11px] text-[#7A7064]">
        <span>Hiển thị 3 trang trước và sau vị trí trích dẫn</span>
        <span className="font-serif italic hidden sm:inline">Văn bản PDF thư tịch</span>
      </div>
    </div>
  );
};