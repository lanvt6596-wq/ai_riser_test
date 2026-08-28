import React, { useRef, useEffect } from "react";
import { ResearchEntry, Claim } from "../types";
import { ResearchEntryCard } from "./ResearchEntryCard";
import { ResearchInput } from "./ResearchInput";
import { BookOpen, History, Trash2, PlusCircle, Compass } from "lucide-react";
import { SAMPLE_PARAGRAPHS } from "../data/samples";

interface ResearchSessionProps {
  entries: ResearchEntry[];
  selectedClaimId: string | null;
  isLoading: boolean;
  onSelectClaim: (claimId: string) => void;
  onRemoveEntry: (entryId: string) => void;
  onClearSession: () => void;
  onSearchNewText: (text: string) => void;
}

export const ResearchSession: React.FC<ResearchSessionProps> = ({
  entries,
  selectedClaimId,
  isLoading,
  onSelectClaim,
  onRemoveEntry,
  onClearSession,
  onSearchNewText,
}) => {
  const scrollBottomRef = useRef<HTMLDivElement | null>(null);

  // Auto scroll to bottom when a new entry is added
  useEffect(() => {
    if (entries.length > 0) {
      scrollBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [entries.length]);

  return (
    <div className="bg-[#FAF7F0] border border-[#E3DAC8] rounded-xl p-4 sm:p-5 shadow-xs flex flex-col h-full min-h-[500px]">
      {/* Session Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#E8DFC8]">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-[#F0E8D7] text-[#8B261E] border border-[#E2D6C0]">
            <History className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#1F1B18] font-serif uppercase tracking-wide">
              Phiên tra cứu
            </h3>
            <p className="text-[11px] text-[#7A7064]">
              {entries.length > 0
                ? `${entries.length} đoạn văn bản trong phiên này`
                : "Phiên làm việc tạm thời"}
            </p>
          </div>
        </div>

        {entries.length > 0 && (
          <button
            type="button"
            onClick={onClearSession}
            disabled={isLoading}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium text-[#7A6E5F] hover:text-[#8B261E] hover:bg-[#EFE7D5] border border-[#DDD4C1] transition-colors cursor-pointer disabled:opacity-50"
            title="Làm mới toàn bộ phiên tra cứu"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Làm mới phiên</span>
          </button>
        )}
      </div>

      {/* Entries List (Scrollable Chronological Session) */}
      <div className="grow overflow-y-auto pr-1 space-y-4 mb-4">
        {entries.length === 0 ? (
          <div className="py-8 px-4 text-center space-y-4 bg-[#FCFBF8] border border-[#E8DFC8] rounded-xl my-auto">
            <div className="w-12 h-12 rounded-xl bg-[#F2ECDF] text-[#8B261E] mx-auto flex items-center justify-center border border-[#DFD4C0]">
              <Compass className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-serif font-bold text-sm text-[#1F1B18]">
                Bắt đầu phiên nghiên cứu sử liệu
              </h4>
              <p className="text-xs text-[#6B6156] mt-1 max-w-sm mx-auto leading-relaxed">
                Nhập hoặc dán các đoạn văn bản lịch sử ở bên dưới. Các phát biểu sẽ được đánh dấu trực tiếp để bạn đối chiếu với thư tịch cổ.
              </p>
            </div>

            {/* Quick Starters */}
            <div className="pt-2">
              <p className="text-[11px] font-semibold text-[#8B261E] uppercase tracking-wider mb-2">
                Hoặc chọn nhanh đoạn mẫu:
              </p>
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                {SAMPLE_PARAGRAPHS.slice(0, 3).map((sample) => (
                  <button
                    key={sample.id}
                    type="button"
                    onClick={() => onSearchNewText(sample.content)}
                    disabled={isLoading}
                    className="px-2.5 py-1 rounded-md bg-[#F2EADB] hover:bg-[#EAE0CD] text-[11px] font-medium text-[#4A4036] border border-[#D8CDB6] transition-colors cursor-pointer"
                  >
                    {sample.title}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          entries.map((entry) => (
            <ResearchEntryCard
              key={entry.id}
              entry={entry}
              selectedClaimId={selectedClaimId}
              onSelectClaim={onSelectClaim}
              onRemoveEntry={onRemoveEntry}
            />
          ))
        )}
        <div ref={scrollBottomRef} />
      </div>

      {/* Persistent Input at Bottom */}
      <div className="pt-2 border-t border-[#E8DFC8]">
        <ResearchInput onSearch={onSearchNewText} isLoading={isLoading} />
      </div>
    </div>
  );
};
