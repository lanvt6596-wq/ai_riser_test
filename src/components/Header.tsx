import React, { useState } from "react";
import { BookOpen, Info, Sparkles, X, ShieldAlert } from "lucide-react";

export const Header: React.FC = () => {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <header className="border-b border-[#E6DEC8] bg-[#FDFBF7]/90 backdrop-blur-xs sticky top-0 z-30 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
        {/* Brand / Emblem */}
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-[#8B261E] text-[#FBF8F2] flex items-center justify-center shadow-xs border border-[#6B1B15] flex-shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-[#1F1B18] font-serif">
                Tra cứu Sử liệu Việt Nam
              </h1>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#F1E8D9] text-[#78350F] border border-[#E3D3BE]">
                Thư tịch cổ
              </span>
            </div>
          </div>
        </div>

        {/* Actions & Info */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setShowInfo(true)}
            id="btn-app-info"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-[#4A4036] hover:text-[#1F1B18] bg-[#F3EFE6] hover:bg-[#EAE3D2] border border-[#DDD4C1] transition-colors cursor-pointer"
            title="Nguyên tắc nghiên cứu sử liệu"
          >
            <Info className="w-3.5 h-3.5 text-[#8B261E]" />
            <span className="hidden sm:inline">Nguyên tắc sử liệu</span>
          </button>
        </div>
      </div>

      {/* Info Modal / Dialog */}
      {showInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs">
          <div className="bg-[#FAF7F0] border border-[#DCD3BE] rounded-xl shadow-xl max-w-lg w-full p-6 text-[#2C2825] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#E8DFC8]">
              <div className="flex items-center gap-2 text-[#8B261E]">
                <ShieldAlert className="w-5 h-5" />
                <h3 className="font-serif font-bold text-lg text-[#1F1B18]">
                  Nguyên tắc tiếp cận sử liệu
                </h3>
              </div>
              <button
                onClick={() => setShowInfo(false)}
                className="p-1 rounded-md text-[#786F66] hover:text-[#1F1B18] hover:bg-[#EAE3D2] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-sm text-[#4A423A] leading-relaxed">
              <div className="p-3 bg-[#F2EBDB] rounded-lg border border-[#E0D4BE]">
                <p className="font-medium text-[#1F1B18] text-xs uppercase tracking-wider mb-1 text-[#8B261E]">
                  Không phải công cụ kiểm tra đúng/sai (Fact-checking)
                </p>
                <p className="text-xs text-[#5C5248]">
                  Hệ thống không phân định phát biểu là “Đúng”, “Sai”, “Đã xác minh” hay “Bị bác bỏ”.
                </p>
              </div>

              <p>
                Mục đích cốt lõi là <strong>rút ngắn khoảng cách giữa người đọc và văn bản sử liệu gốc</strong>:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-xs text-[#5C5248]">
                <li>
                  Tách các phát biểu lịch sử có ngữ cảnh từ văn bản bạn nhập vào.
                </li>
                <li>
                  Truy vấn các đoạn văn bản tương ứng từ các bộ chính sử (như <em>Đại Việt Sử Ký Toàn Thư, Khâm Định Việt Sử Thông Giám Cương Mục, Vương Triều Trần...</em>).
                </li>
                <li>
                  Trình bày nguyên văn trích đoạn, số trang, đề mục và chú thích để bạn <strong>tự đọc, đối chiếu và tự đưa ra nhận định học thuật</strong>.
                </li>
              </ul>

              <p className="text-xs text-[#786F66] italic border-t border-[#E8DFC8] pt-2.5">
                * Nếu một phát biểu chưa tìm thấy đoạn sử liệu trong kho hiện tại, điều đó chỉ có nghĩa kho dữ liệu số chưa bao quát đến trích đoạn đó, không đồng nghĩa phát biểu là sai.
              </p>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setShowInfo(false)}
                className="px-4 py-2 bg-[#8B261E] hover:bg-[#721F18] text-white text-xs font-medium rounded-md shadow-xs transition-colors cursor-pointer"
              >
                Đã hiểu & Tiếp tục
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
