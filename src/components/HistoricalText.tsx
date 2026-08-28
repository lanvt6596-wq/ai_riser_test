import React, { useMemo } from "react";
import { Claim } from "../types";
import { segmentOriginalText } from "../utils/textHighlighter";

interface HistoricalTextProps {
  originalText: string;
  claims: Claim[];
  selectedClaimId: string | null;
  onSelectClaim: (claimId: string) => void;
}

export const HistoricalText: React.FC<HistoricalTextProps> = ({
  originalText,
  claims,
  selectedClaimId,
  onSelectClaim,
}) => {
  const segments = useMemo(
    () => segmentOriginalText(originalText, claims),
    [originalText, claims]
  );

  return (
    <div className="text-sm sm:text-[15px] font-serif text-[#241F1C] leading-relaxed text-justify select-text">
      {segments.map((seg, idx) => {
        if (!seg.isMatch || !seg.claimId) {
          return <span key={idx}>{seg.text}</span>;
        }

        const isSelected = seg.claimId === selectedClaimId;
        const matchingClaim = claims.find((c) => c.id === seg.claimId);
        const evidenceCount = matchingClaim?.evidence?.length || 0;

        return (
          <mark
            key={idx}
            onClick={(e) => {
              e.stopPropagation();
              if (seg.claimId) onSelectClaim(seg.claimId);
            }}
            title={
              evidenceCount > 0
                ? `${evidenceCount} nguồn sử liệu đối chiếu`
                : "Chưa tìm thấy đoạn sử liệu trong kho"
            }
            className={`transition-colors duration-150 inline cursor-pointer rounded-xs px-1 py-0.5 mx-0.5 ${
              isSelected
                ? "bg-[#FDE792] text-[#241F1C] border-b-2 border-[#8B261E] font-medium"
                : "bg-[#F6ECBF] text-[#241F1C] border-b border-[#D5C6A0] hover:bg-[#EFE2AF]"
            }`}
          >
            {seg.text}
          </mark>
        );
      })}
    </div>
  );
};
