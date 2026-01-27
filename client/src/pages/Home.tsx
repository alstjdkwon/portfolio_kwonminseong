import { useState, useRef, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Menu,
  Download,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Design Philosophy: Minimal Utility Interface
 * - Dark tone background for professional look
 * - Left sidebar with page thumbnails (Chrome PDF style)
 * - Top toolbar with navigation and controls
 * - Smooth animations and hover effects
 */

export default function Home() {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [pageInput, setPageInput] = useState("1");

  // 페이지 입력 처리
  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInput(e.target.value);
  };

  const handlePageInputSubmit = () => {
    const page = parseInt(pageInput, 10);
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    } else {
      setPageInput(String(currentPage));
    }
  };

  // 페이지 이동
  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
      setPageInput(String(currentPage - 1));
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
      setPageInput(String(currentPage + 1));
    }
  };

  // 줌 컨트롤
  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 10, 200));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 10, 50));
  };

  // 회전
  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // iframe 로드 시 페이지 수 계산 (간단한 추정)
  const handleIframeLoad = () => {
    // 포트폴리오 HTML의 페이지 수를 추정합니다
    // 실제로는 HTML 구조에 따라 조정이 필요할 수 있습니다
    setTotalPages(6); // 이미지에서 보이는 페이지 수
  };

  return (
    <div className="flex h-screen bg-[#2d2d2d] text-[#e0e0e0]">
      {/* 사이드바 - 페이지 썸네일 */}
      <div
        className={`transition-all duration-300 ease-in-out ${
          sidebarOpen ? "w-48" : "w-0"
        } bg-[#1a1a1a] border-r border-[#404040] overflow-hidden flex flex-col`}
      >
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <div
              key={page}
              onClick={() => {
                setCurrentPage(page);
                setPageInput(String(page));
              }}
              className={`
                cursor-pointer rounded border-2 transition-all duration-200
                ${
                  currentPage === page
                    ? "border-[#4a9eff] bg-[#404040]"
                    : "border-[#404040] bg-[#2d2d2d] hover:border-[#505050]"
                }
                aspect-[8.5/11] flex items-center justify-center text-sm font-medium
              `}
            >
              <span className="text-center">{page}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 메인 콘텐츠 영역 */}
      <div className="flex-1 flex flex-col">
        {/* 상단 도구 모음 */}
        <div className="bg-[#3d3d3d] border-b border-[#404040] px-4 py-2 flex items-center justify-between gap-2 h-14">
          {/* 왼쪽: 메뉴 및 파일 정보 */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-[#e0e0e0] hover:bg-[#505050]"
            >
              {sidebarOpen ? (
                <Menu className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </Button>
            <span className="text-sm font-medium ml-2">포트폴리오.html</span>
          </div>

          {/* 중앙: 페이지 네비게이션 */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={goToPreviousPage}
              disabled={currentPage === 1}
              className="text-[#e0e0e0] hover:bg-[#505050] disabled:opacity-50"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>

            <div className="flex items-center gap-1 px-2">
              <input
                type="text"
                value={pageInput}
                onChange={handlePageInputChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handlePageInputSubmit();
                  }
                }}
                onBlur={handlePageInputSubmit}
                className="w-10 bg-[#2d2d2d] text-[#e0e0e0] border border-[#404040] rounded px-1 py-0.5 text-center text-sm"
              />
              <span className="text-sm text-[#a0a0a0]">/ {totalPages}</span>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={goToNextPage}
              disabled={currentPage === totalPages}
              className="text-[#e0e0e0] hover:bg-[#505050] disabled:opacity-50"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>

          {/* 오른쪽: 줌 및 기타 컨트롤 */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleZoomOut}
              className="text-[#e0e0e0] hover:bg-[#505050]"
            >
              <ZoomOut className="w-5 h-5" />
            </Button>

            <span className="text-sm text-[#a0a0a0] w-12 text-center">
              {zoom}%
            </span>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleZoomIn}
              className="text-[#e0e0e0] hover:bg-[#505050]"
            >
              <ZoomIn className="w-5 h-5" />
            </Button>

            <div className="w-px h-6 bg-[#404040] mx-1" />

            <Button
              variant="ghost"
              size="sm"
              onClick={handleRotate}
              className="text-[#e0e0e0] hover:bg-[#505050]"
            >
              <RotateCw className="w-5 h-5" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="text-[#e0e0e0] hover:bg-[#505050]"
            >
              <Download className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* 메인 뷰어 영역 */}
        <div className="flex-1 overflow-auto bg-[#1a1a1a] flex items-center justify-center p-4">
          <div
            className="bg-white rounded shadow-2xl transition-transform duration-300"
            style={{
              transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
              transformOrigin: "center",
            }}
          >
            <iframe
              ref={iframeRef}
              src="/portfolio.html"
              onLoad={handleIframeLoad}
              className="w-[8.5in] h-[11in] border-0"
              title="Portfolio"
              sandbox="allow-same-origin allow-scripts"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
