import React, { useState, useEffect } from "react";
import {
  BookOpen,
  Library,
  ChevronLeft,
  ChevronRight,
  BookMarked,
  Bookmark,
  AlignLeft,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Copy,
  Check,
  Search,
} from "lucide-react";
import { Claim, Evidence } from "../types";
import { getSourcePdfUrl } from "../services/pdfService";
import { PdfViewer } from "./PdfViewer";

interface SourceReaderProps {
  selectedClaim: Claim | null;
  claimIndex: number;
  activeEvidenceIndex: number;
  onChangeEvidenceIndex: (index: number) => void;
}

export const SourceReader: React.FC<SourceReaderProps> = ({
  selectedClaim,
  claimIndex,
  activeEvidenceIndex,
  onChangeEvidenceIndex,
}) => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfBookName, setPdfBookName] = useState<string>("");
  const [isLoadingPdfUrl, setIsLoadingPdfUrl] = useState<boolean>(false);
  const [pdfLoadError, setPdfLoadError] = useState<string | null>(null);
  const [showFootnotes, setShowFootnotes] = useState<boolean>(false);
  const [isRetrievedTextExpanded, setIsRetrievedTextExpanded] = useState<boolean>(false);
  const [copiedExcerpt, setCopiedExcerpt] = useState<boolean>(false);
  const [highlightFoundOnPage, setHighlightFoundOnPage] = useState<boolean>(true);

  const evidenceList = selectedClaim?.evidence || [];
  const hasEvidence = evidenceList.length > 0;
  const currentEvidence: Evidence | null = hasEvidence
    ? evidenceList[activeEvidenceIndex] || evidenceList[0]
    : null;

  // Determine source_id from current evidence
  const resolveSourceId = (ev: Evidence | null): string => {
    if (!ev) return "";
    if (ev.source_id && ev.source_id.trim()) return ev.source_id.trim();

    const book = (ev.book_name || "").toLowerCase();
    if (book.includes("toàn thư") || book.includes("đại việt sử ký")) return "dvsk";
    if (book.includes("cương mục") || book.includes("khâm định")) return "kdvstgcm";
    if (book.includes("thực lục") || book.includes("vương triều trần")) return "vtt";
    if (book.includes("tiền lê") || book.includes("thông thư")) return "vstt";
    return "dvsk";
  };

  // Fetch signed PDF URL whenever current evidence changes
  useEffect(() => {
    if (!currentEvidence) {
      setPdfUrl(null);
      return;
    }

    const sourceId = resolveSourceId(currentEvidence);
    let isCancelled = false;
    setIsLoadingPdfUrl(true);
    setPdfLoadError(null);
    setHighlightFoundOnPage(true);

    getSourcePdfUrl(sourceId)
      .then((res) => {
        if (!isCancelled) {
          setPdfUrl(res.url);
          setPdfBookName(res.book_name);
          setIsLoadingPdfUrl(false);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error("Failed to get PDF URL:", err);
          setPdfLoadError("Không thể tải đường dẫn tệp PDF cho nguồn này.");
          setIsLoadingPdfUrl(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [currentEvidence?.chunk_id, currentEvidence?.source_id, currentEvidence?.book_name]);

  // Extract non-empty headers
  const headerEntries = currentEvidence?.headers
    ? Object.entries(currentEvidence.headers).filter(
        ([_, val]) => typeof val === "string" && val.trim() !== ""
      )
    : [];

  // Extract non-empty footnotes
  const footnoteEntries = currentEvidence?.footnotes
    ? Object.entries(currentEvidence.footnotes).filter(
        ([_, val]) => typeof val === "string" && val.trim() !== ""
      )
    : [];

  const targetPage =
    currentEvidence?.pages && currentEvidence.pages.length > 0
      ? currentEvidence.pages[0]
      : 1;

  const formattedPages =
    currentEvidence?.pages && currentEvidence.pages.length > 0
      ? currentEvidence.pages.join(", ")
      : null;

  const handleCopyExcerpt = () => {
    if (!currentEvidence) return;
    let citation = `[Trích nguồn] ${currentEvidence.book_name || "Sử liệu Việt Nam"}`;
    if (formattedPages) citation += `, Trang ${formattedPages}`;
    if (headerEntries.length > 0) {
      citation += ` (${headerEntries.map(([_, h]) => h).join(" - ")})`;
    }
    citation += `:\n"${currentEvidence.text}"`;
    navigator.clipboard.writeText(citation);
    setCopiedExcerpt(true);
    setTimeout(() => setCopiedExcerpt(false), 2000);
  };

  // Case 1: No claim selected
  if (!selectedClaim) {
    return (
      <div className="bg-[#FAF7F0] border border-[#E3DAC8] rounded-xl p-8 sm:p-12 shadow-xs flex flex-col items-center justify-center text-center h-full min-h-[500px]">
        <div className="w-14 h-14 rounded-2xl bg-[#F0E8D7] text-[#8B261E] flex items-center justify-center mb-4 border border-[#E0D4BD] shadow-2xs">
          <Library className="w-7 h-7" />
        </div>
        <h3 className="font-serif font-bold text-lg text-[#1F1B18]">
          NGUỒN SỬ LIỆU
        </h3>
        <p className="text-xs sm:text-sm text-[#6B6156] max-w-md mt-2 leading-relaxed">
          Nhấp vào bất kỳ đoạn văn bản được tô sáng ở cột bên trái để mở toàn văn thư tịch cổ tương ứng tại trang trích dẫn.
        </p>
        <div className="mt-6 flex items-center gap-2 text-xs text-[#8C8072] italic bg-[#F4EFE5] px-3.5 py-1.5 rounded-full border border-[#E4DCB]">
          <Search className="w-3.5 h-3.5 text-[#8B261E]" />
          <span>Tự động mở trang và đối chiếu dẫn chứng trong tệp PDF</span>
        </div>
      </div>
    );
  }

  // Case 2: Selected claim has NO evidence
  if (!hasEvidence || !currentEvidence) {
    return (
      <div className="bg-[#FAF7F0] border border-[#E3DAC8] rounded-xl p-6 sm:p-8 shadow-xs flex flex-col h-full">
        <div className="pb-4 mb-4 border-b border-[#E8DFC8] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-[#F0E8D7] text-[#8B261E] border border-[#E2D6C0]">
              <Library className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#1F1B18] font-serif uppercase tracking-wide">
                NGUỒN SỬ LIỆU
              </h3>
            </div>
          </div>
        </div>

        <div className="my-auto p-6 sm:p-8 bg-[#FCFBF8] border border-[#E3DAC8] rounded-xl text-center space-y-4 max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-full bg-[#F5EFE0] text-[#A37B30] mx-auto flex items-center justify-center border border-[#E5DAC4]">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-serif font-bold text-base text-[#241F1B]">
              Chưa tìm thấy đoạn sử liệu phù hợp trong kho dữ liệu hiện tại.
            </h4>
            <p className="text-xs text-[#6B6156] mt-2 leading-relaxed">
              Hệ thống chưa tìm thấy trích đoạn có độ tương đồng đủ cao trong các bộ chính sử đã được số hóa.
            </p>
          </div>

          <div className="p-3.5 bg-[#F4ECE0] rounded-lg border border-[#DFD4C0] text-xs text-[#7A3E16] text-left">
            <p className="font-semibold text-[11px] uppercase tracking-wide text-[#8B261E]">
              Ghi chú học thuật:
            </p>
            <p className="text-xs mt-1 text-[#5C4230] leading-relaxed">
              Điều này không đồng nghĩa nội dung trên là sai.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Case 3: Claim has evidence passages and PDF reader
  return (
    <div className="bg-[#FAF7F0] border border-[#E3DAC8] rounded-xl p-4 sm:p-5 shadow-xs flex flex-col h-full space-y-3.5">
      {/* 1. Header: Book Name, Section, Page & Navigation */}
      <div className="pb-3 border-b border-[#E8DFC8]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          {/* Book & Section Title */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-[#8B261E] text-white flex-shrink-0">
                <BookOpen className="w-4 h-4" />
              </div>
              <h3 className="text-base sm:text-lg font-bold font-serif text-[#1C1815] tracking-wide uppercase">
                {currentEvidence.book_name || pdfBookName || "Thư tịch cổ"}
              </h3>
            </div>

            {headerEntries.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-[#6B5F52] font-serif pl-8">
                <Bookmark className="w-3.5 h-3.5 text-[#A69986] flex-shrink-0" />
                <span>
                  {headerEntries.map(([_, headerText], i) => (
                    <span key={i}>
                      {i > 0 && " · "}
                      {headerText}
                    </span>
                  ))}
                </span>
              </div>
            )}
          </div>

          {/* Evidence Navigator & Page Badge */}
          <div className="flex items-center gap-2">
            {formattedPages && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#F2EBDB] text-[#4A4035] text-xs font-serif font-medium border border-[#E0D5BE]">
                <BookMarked className="w-3.5 h-3.5 text-[#8B261E]" />
                <span>Trang {formattedPages}</span>
              </span>
            )}

            {evidenceList.length > 1 && (
              <div className="flex items-center gap-1 bg-[#EFE8D8] p-1 rounded-lg border border-[#DCD1BC]">
                <button
                  type="button"
                  onClick={() =>
                    onChangeEvidenceIndex(
                      activeEvidenceIndex > 0
                        ? activeEvidenceIndex - 1
                        : evidenceList.length - 1
                    )
                  }
                  className="p-1 rounded text-[#5E544B] hover:text-[#1F1B18] hover:bg-[#E4DAC5] transition-colors cursor-pointer"
                  title="Nguồn trước"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <span className="text-xs font-medium text-[#4A4137] px-1.5 select-none font-serif">
                  Nguồn {activeEvidenceIndex + 1} / {evidenceList.length}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    onChangeEvidenceIndex(
                      activeEvidenceIndex < evidenceList.length - 1
                        ? activeEvidenceIndex + 1
                        : 0
                    )
                  }
                  className="p-1 rounded text-[#5E544B] hover:text-[#1F1B18] hover:bg-[#E4DAC5] transition-colors cursor-pointer"
                  title="Nguồn kế tiếp"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Retrieved Passage (Đoạn được truy xuất) - Compact & Collapsible */}
      <div className="bg-[#FCFBF8] border border-[#E3DAC8] rounded-lg overflow-hidden shadow-2xs">
        <div className="px-3.5 py-1.5 bg-[#F6F1E5] border-b border-[#E8DFC8] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold font-serif text-[#8B261E] text-[11px] uppercase tracking-wider">
              Đoạn được truy xuất
            </span>
            {!highlightFoundOnPage && (
              <span className="text-[11px] text-[#8C6B14] italic">
                (Chưa thể xác định chính xác vị trí đoạn trích trên trang)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyExcerpt}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-[#5E544B] hover:text-[#1F1B18] hover:bg-[#EAE2D2] border border-[#DDD4C1] transition-colors cursor-pointer"
              title="Sao chép đoạn trích kèm nguồn dẫn"
            >
              {copiedExcerpt ? (
                <>
                  <Check className="w-3 h-3 text-emerald-700" />
                  <span className="text-emerald-700">Đã chép</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Sao chép</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsRetrievedTextExpanded(!isRetrievedTextExpanded)}
              className="p-1 rounded text-[#6E6458] hover:text-[#1F1B18] hover:bg-[#EAE2D2] transition-colors cursor-pointer"
              title={isRetrievedTextExpanded ? "Thu gọn" : "Xem đầy đủ"}
            >
              {isRetrievedTextExpanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        <div
          className={`p-3 bg-[#FAF7F0] border-l-3 border-[#8B261E] text-xs sm:text-sm font-serif text-[#241F1B] leading-relaxed text-justify select-text ${
            isRetrievedTextExpanded ? "max-h-64 overflow-y-auto" : "line-clamp-3"
          }`}
        >
          "{currentEvidence.text}"
        </div>
      </div>

      {/* 3. Footnotes Section if available */}
      {footnoteEntries.length > 0 && (
        <div className="bg-[#F6F1E5] border border-[#E3DAC8] rounded-lg overflow-hidden text-xs">
          <button
            type="button"
            onClick={() => setShowFootnotes(!showFootnotes)}
            className="w-full px-3.5 py-1.5 flex items-center justify-between text-left font-serif font-bold text-[#695F53] uppercase tracking-wide hover:bg-[#EDE6D7] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-1.5">
              <AlignLeft className="w-3.5 h-3.5 text-[#8B261E]" />
              <span>Xem chú thích thư tịch ({footnoteEntries.length})</span>
            </div>
            {showFootnotes ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {showFootnotes && (
            <div className="p-3 bg-[#FAF7F0] border-t border-[#E8DFC8] space-y-1.5 max-h-40 overflow-y-auto">
              {footnoteEntries.map(([key, noteText]) => (
                <div key={key} className="flex items-start gap-1.5 text-xs text-[#52483E]">
                  <span className="font-semibold text-[#8B261E] min-w-[24px]">
                    [{key}]:
                  </span>
                  <span className="leading-relaxed">{noteText}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. PDF Viewer Section */}
      <div className="grow min-h-[460px] flex flex-col">
        {isLoadingPdfUrl ? (
          <div className="grow flex flex-col items-center justify-center p-8 bg-[#FAF7F0] border border-[#E3DAC8] rounded-xl text-center">
            <div className="w-10 h-10 rounded-full bg-[#8B261E] text-white flex items-center justify-center animate-pulse mb-3">
              <BookOpen className="w-5 h-5" />
            </div>
            <p className="text-xs font-serif font-semibold text-[#1F1B18]">
              Đang xác thực và nạp tệp PDF chính sử...
            </p>
            <p className="text-[11px] text-[#7A7064] mt-1">
              Đang kết nối tới kho lưu trữ thư tịch số
            </p>
          </div>
        ) : pdfLoadError ? (
          <div className="grow flex flex-col items-center justify-center p-8 bg-[#FAF7F0] border border-[#E6D0C5] rounded-xl text-center">
            <AlertCircle className="w-8 h-8 text-[#8B261E] mb-2" />
            <h4 className="font-serif font-bold text-sm text-[#1F1B18]">
              Không thể tải toàn văn PDF
            </h4>
            <p className="text-xs text-[#7A6E5F] mt-1 max-w-sm">
              {pdfLoadError}
            </p>
          </div>
        ) : pdfUrl ? (
          <PdfViewer
            pdfUrl={pdfUrl}
            bookTitle={currentEvidence.book_name}
            initialPage={targetPage}
            highlightText={currentEvidence.text}
            highlightPages={currentEvidence.pages}
            onHighlightStatusChange={(found) => setHighlightFoundOnPage(found)}
          />
        ) : (
          <div className="grow flex items-center justify-center p-8 bg-[#FAF7F0] border border-[#E3DAC8] rounded-xl text-center text-xs text-[#7A7064]">
            Chưa có tệp PDF cho nguồn này.
          </div>
        )}
      </div>
    </div>
  );
};
