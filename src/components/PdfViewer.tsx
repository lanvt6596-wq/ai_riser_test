import React, { useEffect, useRef, useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  AlertCircle,
  FileText,
  Search,
} from "lucide-react";

// Configure worker safely
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
  onHighlightStatusChange?: (found: boolean) => void;
}

/**
 * Normalizes text for historical text matching:
 * NFC unicode, lowercase, collapsed spaces.
 */
function normalizeText(str: string): string {
  return (str || "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const PdfViewer: React.FC<PdfViewerProps> = ({
  pdfUrl,
  bookTitle,
  initialPage = 1,
  highlightText,
  onHighlightStatusChange,
}) => {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [numPages, setNumPages] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.25);
  const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(true);
  const [isRenderingPage, setIsRenderingPage] = useState<boolean>(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [highlightFound, setHighlightFound] = useState<boolean>(false);
  const [pageInputValue, setPageInputValue] = useState<string>(String(initialPage));

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeRenderTaskRef = useRef<any>(null);
  const activeLoadingTaskRef = useRef<any>(null);

  // Sync initialPage whenever target changes
  useEffect(() => {
    if (initialPage && initialPage > 0) {
      const validPage = pdfDoc ? Math.max(1, Math.min(initialPage, pdfDoc.numPages)) : initialPage;
      setCurrentPage(validPage);
      setPageInputValue(String(validPage));
    }
  }, [initialPage, pdfUrl]);

  // Load PDF Document cleanly
  useEffect(() => {
    let isCancelled = false;

    // Cancel any previous loading task
    if (activeLoadingTaskRef.current) {
      try {
        activeLoadingTaskRef.current.destroy();
      } catch {}
    }

    setIsLoadingPdf(true);
    setPdfError(null);
    setPdfDoc(null);
    setHighlightFound(false);

    const loadingTask = pdfjsLib.getDocument({
      url: pdfUrl,
      cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/standard_fonts/`,
    });

    activeLoadingTaskRef.current = loadingTask;

    loadingTask.promise
      .then((doc) => {
        if (!isCancelled) {
          setPdfDoc(doc);
          setNumPages(doc.numPages);
          const safeTarget = Math.max(1, Math.min(initialPage || 1, doc.numPages));
          setCurrentPage(safeTarget);
          setPageInputValue(String(safeTarget));
          setIsLoadingPdf(false);
        }
      })
      .catch((err: any) => {
        if (!isCancelled) {
          console.error("PDF load error:", err);
          setPdfError("Không thể tải tài liệu gốc. Vui lòng thử lại.");
          setIsLoadingPdf(false);
        }
      });

    return () => {
      isCancelled = true;
      try {
        loadingTask.destroy();
      } catch {}
    };
  }, [pdfUrl]);

  // Render Page Canvas and Transparent Text Layer
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return;

    const safePageNumber = Math.max(1, Math.min(currentPage, pdfDoc.numPages));

    try {
      setIsRenderingPage(true);

      // Cancel previous page rendering task if active
      if (activeRenderTaskRef.current) {
        try {
          activeRenderTaskRef.current.cancel();
        } catch {}
      }

      const page = await pdfDoc.getPage(safePageNumber);
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) return;

      const viewport = page.getViewport({ scale });
      const pixelRatio = window.devicePixelRatio || 1;

      // Set canvas dimensions
      canvas.width = Math.floor(viewport.width * pixelRatio);
      canvas.height = Math.floor(viewport.height * pixelRatio);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      context.save();
      context.scale(pixelRatio, pixelRatio);

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      const renderTask = page.render(renderContext);
      activeRenderTaskRef.current = renderTask;
      await renderTask.promise;
      context.restore();

      // Render Text Layer for Selection & Passage Highlighting
      if (textLayerRef.current) {
        const textLayerDiv = textLayerRef.current;
        textLayerDiv.innerHTML = "";
        textLayerDiv.style.width = `${Math.floor(viewport.width)}px`;
        textLayerDiv.style.height = `${Math.floor(viewport.height)}px`;

        const textContent = await page.getTextContent();
        const cleanEvidence = normalizeText(highlightText || "");

        // Build continuous page text stream to locate evidence passage
        interface ItemMeta {
          item: any;
          str: string;
          normStr: string;
          startInStream: number;
          endInStream: number;
          index: number;
        }

        const itemsMeta: ItemMeta[] = [];
        let pageTextStream = "";

        textContent.items.forEach((item: any, idx: number) => {
          const rawStr = item.str || "";
          const norm = normalizeText(rawStr);
          const start = pageTextStream.length;
          if (norm.length > 0) {
            pageTextStream += norm + " ";
          }
          const end = pageTextStream.length;

          itemsMeta.push({
            item,
            str: rawStr,
            normStr: norm,
            startInStream: start,
            endInStream: end,
            index: idx,
          });
        });

        // Search for evidence passage in stream
        let matchStreamStart = -1;
        let matchStreamEnd = -1;

        if (cleanEvidence.length >= 6) {
          // 1. Try exact evidence text match
          const exactPos = pageTextStream.indexOf(cleanEvidence);
          if (exactPos !== -1) {
            matchStreamStart = exactPos;
            matchStreamEnd = exactPos + cleanEvidence.length;
          } else {
            // 2. Try consecutive distinctive phrase (sliding window of 6-8 words)
            const evidenceWords = cleanEvidence.split(" ").filter(Boolean);
            const windowSize = Math.min(8, evidenceWords.length);

            for (let w = 0; w <= evidenceWords.length - windowSize; w++) {
              const phrase = evidenceWords.slice(w, w + windowSize).join(" ");
              if (phrase.length >= 24) {
                const phrasePos = pageTextStream.indexOf(phrase);
                if (phrasePos !== -1) {
                  matchStreamStart = phrasePos;
                  matchStreamEnd = phrasePos + phrase.length;
                  break;
                }
              }
            }
          }
        }

        const matchedIndices = new Set<number>();
        if (matchStreamStart !== -1 && matchStreamEnd !== -1) {
          itemsMeta.forEach((meta) => {
            if (
              meta.normStr.length > 0 &&
              meta.startInStream < matchStreamEnd &&
              meta.endInStream > matchStreamStart
            ) {
              matchedIndices.add(meta.index);
            }
          });
        }

        const isFound = matchedIndices.size > 0;
        setHighlightFound(isFound);
        onHighlightStatusChange?.(isFound);

        let firstHighlightElement: HTMLElement | null = null;

        // Render transparent spans on text layer
        itemsMeta.forEach((meta) => {
          if (!meta.str || meta.str.trim() === "") return;

          const item = meta.item;
          const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
          const fontHeight = Math.sqrt(tx[2] * tx[2] + tx[3] * tx[3]);

          const span = document.createElement("span");
          span.textContent = item.str;
          span.style.position = "absolute";
          span.style.left = `${tx[4]}px`;
          span.style.top = `${tx[5] - fontHeight}px`;
          span.style.fontSize = `${fontHeight}px`;
          span.style.fontFamily = item.fontName || "sans-serif";
          span.style.transformOrigin = "left bottom";
          span.style.whiteSpace = "pre";
          // TEXT IS ALWAYS TRANSPARENT: NEVER RECOLOR PDF TEXT
          span.style.color = "transparent";
          span.className = "select-text cursor-text";

          // If this span belongs to the matched evidence passage:
          if (matchedIndices.has(meta.index)) {
            // Apply soft translucent archival yellow background ONLY
            span.style.backgroundColor = "rgba(254, 240, 138, 0.45)";
            span.style.borderRadius = "2px";
            if (!firstHighlightElement) {
              firstHighlightElement = span;
            }
          }

          textLayerDiv.appendChild(span);
        });

        // Smooth scroll to highlight if found
        if (firstHighlightElement && containerRef.current) {
          setTimeout(() => {
            firstHighlightElement?.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
          }, 150);
        }
      }

      setIsRenderingPage(false);
    } catch (err: any) {
      if (err?.name !== "RenderingCancelledException") {
        console.error("PDF page render error:", err);
      }
      setIsRenderingPage(false);
    }
  }, [pdfDoc, currentPage, scale, highlightText, onHighlightStatusChange]);

  // Trigger render when document, page, or scale changes
  useEffect(() => {
    renderPage();
  }, [renderPage]);

  // Page navigation handlers
  const handlePrevPage = () => {
    if (currentPage > 1) {
      const newPage = currentPage - 1;
      setCurrentPage(newPage);
      setPageInputValue(String(newPage));
    }
  };

  const handleNextPage = () => {
    if (pdfDoc && currentPage < pdfDoc.numPages) {
      const newPage = currentPage + 1;
      setCurrentPage(newPage);
      setPageInputValue(String(newPage));
    }
  };

  const handlePageInputCommit = () => {
    const parsed = parseInt(pageInputValue, 10);
    if (!isNaN(parsed) && parsed >= 1 && pdfDoc && parsed <= pdfDoc.numPages) {
      setCurrentPage(parsed);
    } else {
      setPageInputValue(String(currentPage));
    }
  };

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.2, 2.5));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.2, 0.7));
  const handleResetZoom = () => setScale(1.25);

  return (
    <div className="flex flex-col h-full bg-[#FAF7F0] border border-[#E3DAC8] rounded-xl overflow-hidden shadow-xs">
      {/* PDF Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2.5 bg-[#F4EFE5] border-b border-[#E3DAC8] text-xs text-[#4A4036] select-none">
        {/* Left: Page Navigation */}
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
              onChange={(e) => setPageInputValue(e.target.value)}
              onBlur={handlePageInputCommit}
              onKeyDown={(e) => e.key === "Enter" && handlePageInputCommit()}
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

        {/* Right: Zoom & Reset */}
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
            title="Vừa trang"
          >
            Mặc định
          </button>
        </div>
      </div>

      {/* Main PDF Canvas & Text Layer Container */}
      <div
        ref={containerRef}
        className="grow relative overflow-auto bg-[#524E48]/20 flex justify-center p-4 sm:p-6 min-h-[480px] max-h-[75vh]"
      >
        {/* Loading overlay */}
        {isLoadingPdf && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#FAF7F0]/90 backdrop-blur-2xs">
            <RefreshCw className="w-6 h-6 text-[#8B261E] animate-spin mb-2" />
            <p className="text-xs font-serif font-semibold text-[#1F1B18]">
              Đang mở toàn văn thư tịch cổ...
            </p>
            <p className="text-[11px] text-[#7A7064] mt-0.5">
              Đang nạp tệp PDF chính sử
            </p>
          </div>
        )}

        {/* Error overlay */}
        {pdfError && !isLoadingPdf && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 bg-[#FAF7F0]/95 text-center">
            <div className="w-10 h-10 rounded-full bg-[#FDE8E7] text-[#8B261E] flex items-center justify-center mb-2">
              <AlertCircle className="w-5 h-5" />
            </div>
            <h4 className="font-serif font-bold text-sm text-[#1F1B18] mb-1">
              Không thể tải tài liệu gốc. Vui lòng thử lại.
            </h4>
            <p className="text-xs text-[#7A6E5F] max-w-sm mb-4 leading-relaxed">
              {pdfError}
            </p>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-[#8B261E] text-white text-xs font-medium hover:bg-[#701E17] transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Mở tệp trong tab mới</span>
            </a>
          </div>
        )}

        {/* Page Render Wrapper */}
        <div
          className={`relative bg-white shadow-md border border-[#D5C9B3] transition-opacity duration-150 ${
            isRenderingPage ? "opacity-80" : "opacity-100"
          }`}
          style={{ width: "fit-content", height: "fit-content" }}
        >
          <canvas ref={canvasRef} className="block" />
          <div
            ref={textLayerRef}
            className="textLayer absolute inset-0 overflow-hidden pointer-events-auto select-text leading-none"
          />
        </div>
      </div>

      {/* Footer info */}
      <div className="px-4 py-2 bg-[#F6F2E8] border-t border-[#E5DCB] flex items-center justify-between text-[11px] text-[#7A7064]">
        <span>Cuộn hoặc dùng mũi tên để đọc các trang xung quanh</span>
        <span className="font-serif italic hidden sm:inline">Văn bản PDF thư tịch</span>
      </div>
    </div>
  );
};
