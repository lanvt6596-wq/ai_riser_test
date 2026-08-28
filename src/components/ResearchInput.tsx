import React, { useState } from "react";
import { Search, Sparkles, RefreshCw, ChevronDown } from "lucide-react";
import { SAMPLE_PARAGRAPHS } from "../data/samples";
import { SampleParagraph } from "../types";

interface ResearchInputProps {
  onSearch: (text: string) => void;
  isLoading: boolean;
}

export const ResearchInput: React.FC<ResearchInputProps> = ({
  onSearch,
  isLoading,
}) => {
  const [content, setContent] = useState<string>("");
  const [showSampleDropdown, setShowSampleDropdown] = useState<boolean>(false);

  const handleSubmit = () => {
    if (!content.trim() || isLoading) return;
    onSearch(content.trim());
    setContent("");
  };

  const handleSelectSample = (sample: SampleParagraph) => {
    setContent(sample.content);
    setShowSampleDropdown(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !isLoading && content.trim()) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="bg-[#FAF7F0] border border-[#E3DAC8] rounded-xl p-4 shadow-xs relative">
      {/* Editor Box */}
      <div className="relative rounded-lg border border-[#D5C9B3] bg-[#FCFBF8] focus-within:border-[#8B261E] focus-within:ring-2 focus-within:ring-[#8B261E]/20 transition-all">
        <textarea
          id="research-input-textarea"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          rows={3}
          placeholder="Nội dung lịch sử cần tìm nguồn..."
          className="w-full p-3 text-sm text-[#241F1C] placeholder-[#9E9487] bg-transparent border-0 resize-y focus:outline-hidden disabled:opacity-60 leading-relaxed font-sans"
        />
      </div>

      {/* Control Bar */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        {/* Sample selector */}
        <div className="relative">
          <button
            type="button"
            id="btn-sample-content"
            onClick={() => setShowSampleDropdown(!showSampleDropdown)}
            disabled={isLoading}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#4A3F33] bg-[#EFE9DB] hover:bg-[#E4DBC8] border border-[#D5C9B3] transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#8B261E]" />
            <span>Thử mẫu</span>
            <ChevronDown
              className={`w-3 h-3 transition-transform ${
                showSampleDropdown ? "rotate-180" : ""
              }`}
            />
          </button>

          {showSampleDropdown && (
            <div className="absolute left-0 bottom-full mb-1.5 w-72 sm:w-80 bg-[#FAF7F0] border border-[#D5C9B3] rounded-lg shadow-lg z-40 py-1.5 animate-in fade-in-50 zoom-in-95 max-h-64 overflow-y-auto">
              <div className="px-3 py-1 text-[11px] font-semibold text-[#8B261E] uppercase tracking-wider border-b border-[#E8DFC8]">
                Chọn đoạn văn mẫu
              </div>
              {SAMPLE_PARAGRAPHS.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => handleSelectSample(sample)}
                  className="w-full text-left px-3 py-2 hover:bg-[#EFE8D6] transition-colors border-b border-[#F0E9DA] last:border-0"
                >
                  <div className="text-xs font-semibold text-[#1F1B18] font-serif">
                    {sample.title}
                  </div>
                  <div className="text-[11px] text-[#7A7064] mt-0.5">
                    {sample.era}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Submit button */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#8C8276] hidden sm:inline">
            <kbd className="px-1 py-0.5 bg-[#EAE2D0] border border-[#D5CABB] rounded text-[10px] text-[#4A423A]">
              Ctrl
            </kbd>{" "}
            +{" "}
            <kbd className="px-1 py-0.5 bg-[#EAE2D0] border border-[#D5CABB] rounded text-[10px] text-[#4A423A]">
              Enter
            </kbd>
          </span>

          <button
            type="button"
            id="btn-submit-search"
            onClick={handleSubmit}
            disabled={isLoading || !content.trim()}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#8B261E] hover:bg-[#721F18] active:bg-[#5C1813] disabled:opacity-50 disabled:cursor-not-allowed shadow-xs transition-all cursor-pointer"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Đang tìm nguồn...</span>
              </>
            ) : (
              <>
                <Search className="w-3.5 h-3.5" />
                <span>Tìm nguồn sử liệu</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
