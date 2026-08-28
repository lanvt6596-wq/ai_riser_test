import React from "react";
import {
  BookOpen,
  RefreshCw,
  AlertCircle,
  Trash2,
} from "lucide-react";
import { Claim, ResearchEntry } from "../types";
import { HistoricalText } from "./HistoricalText";

interface ResearchEntryCardProps {
  entry: ResearchEntry;
  selectedClaimId: string | null;
  onSelectClaim: (claimId: string) => void;
  onRemoveEntry: (entryId: string) => void;
}

export const ResearchEntryCard: React.FC<ResearchEntryCardProps> = ({
  entry,
  selectedClaimId,
  onSelectClaim,
  onRemoveEntry,
}) => {
  const activeClaim = entry.claims.find((c) => c.id === selectedClaimId);

  return (
    <article
      id={`research-entry-${entry.id}`}
      className="bg-[#FCFBF8] border border-[#E3DAC8] rounded-xl p-4 sm:p-5 shadow-2xs relative transition-all"
    >
      {/* Header: Entry Title & Meta */}
      <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-[#E8DFC8] text-xs">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-[#8B261E] text-white flex items-center justify-center font-serif font-bold text-xs">
            {entry.indexNumber}
          </div>
          <h4 className="font-serif font-bold text-sm text-[#1F1B18]">
            Đoạn tra cứu {entry.indexNumber}
          </h4>
        </div>

        <div className="flex items-center gap-2">
          {entry.status === "success" && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#706456] bg-[#F2ECDF] px-2 py-0.5 rounded border border-[#E2D8C5]">
              <BookOpen className="w-3 h-3 text-[#8B261E]" />
              <span>{entry.claims.length} phát biểu</span>
            </span>
          )}

          <button
            type="button"
            onClick={() => onRemoveEntry(entry.id)}
            className="p-1 rounded text-[#9E9385] hover:text-[#8B261E] hover:bg-[#F3ECE0] transition-colors cursor-pointer"
            title="Xóa đoạn này khỏi phiên làm việc"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Body */}
      {entry.status === "loading" ? (
        <div className="py-6 px-4 bg-[#FAF7F0] rounded-lg border border-[#E5DCB] text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-xs font-serif font-semibold text-[#1F1B18]">
            <RefreshCw className="w-4 h-4 text-[#8B261E] animate-spin" />
            <span>Đang phân tích nội dung và tìm nguồn sử liệu...</span>
          </div>
          <p className="text-[11px] text-[#7A6E60] italic">
            Đang trích xuất phát biểu và đối chiếu với thư tịch cổ
          </p>
        </div>
      ) : entry.status === "error" ? (
        <div className="p-3.5 bg-[#FDF2F0] rounded-lg border border-[#EAC4BC] space-y-1.5 text-xs text-[#6B241E]">
          <div className="flex items-center gap-1.5 font-semibold">
            <AlertCircle className="w-4 h-4" />
            <span>Không thể hoàn tất tra cứu cho đoạn này</span>
          </div>
          <p className="text-[11px] text-[#7A3E39] leading-relaxed">
            {entry.errorMessage || "Không thể kết nối tới dịch vụ tìm nguồn sử liệu."}
          </p>
          <div className="mt-2 text-xs text-[#3E342B] font-serif bg-white/60 p-2 rounded border border-[#F0D5CF]">
            "{entry.inputText}"
          </div>
        </div>
      ) : entry.status === "empty" || entry.claims.length === 0 ? (
        <div className="p-3.5 bg-[#FAF7F0] rounded-lg border border-[#E3DAC8] space-y-2 text-xs text-[#6B6054]">
          <p className="font-serif font-medium text-[#241F1B]">
            "{entry.inputText}"
          </p>
          <div className="pt-2 border-t border-[#EAE1D0] flex items-center gap-1.5 text-[11px] text-[#8C6D23]">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>
              Không tìm thấy phát biểu lịch sử phù hợp để tra cứu trong nội dung này.
            </span>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Interactive Highlighted Historical Text */}
          <div className="p-3.5 bg-[#FAF7F0] rounded-lg border border-[#E3DAC8]">
            <HistoricalText
              originalText={entry.inputText}
              claims={entry.claims}
              selectedClaimId={selectedClaimId}
              onSelectClaim={onSelectClaim}
            />
          </div>

          {/* Compact Normalized Claim Box Directly Below */}
          {activeClaim && (
            <div className="p-3 bg-[#FAF7F0] border border-[#E3DAC8] rounded-lg text-xs transition-all">
              <div className="text-[11px] font-semibold text-[#8B261E] font-serif uppercase tracking-wider mb-1">
                Phát biểu đang chọn
              </div>
              <p className="font-serif text-[#2C2825] leading-relaxed italic text-xs sm:text-[13px]">
                "{activeClaim.claim}"
              </p>
            </div>
          )}
        </div>
      )}
    </article>
  );
};
