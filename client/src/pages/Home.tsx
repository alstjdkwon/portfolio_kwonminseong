import { useState, useRef, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Menu,
  Download,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import * as pdfjsLib from "pdfjs-dist";

/**
 * Design Philosophy: Minimal Utility Interface (PDF Viewer)
 * - Dark tone background for professional PDF viewing
 * - Chrome PDF viewer UI replication
 * - All interactions tracked by Clarity analytics
 * - Optimized for long viewing sessions
 */

// PDF.js worker 설정
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

export default function Home() {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [pdfDocument, setPdfDocument] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageInput, setPageInput] = useState("1");

  // PDF 로드
  useEffect(() => {
    const loadPdf = async () => {
      try {
        setLoading(true);
        const pdf = await pdfjsLib.getDocument("/portfolio.pdf").promise;
        setPdfDocument(pdf);
        setTotalPages(pdf.numPages);
        console.log("PDF 로드 완료:", pdf.numPages, "페이지");
      } catch (error) {
        console.error("PDF 로드 실패:", error);
      } finally {
        setLoading(false);
      }
    };
    loadPdf();
  }, []);

  // 페이지 렌더링
  useEffect(() => {
    if (!pdfDocument || totalPages === 0) {
      console.log("렌더링 조건 불만족:", { pdfDocument: !!pdfDocument, totalPages });
      return;
    }

    const renderPage = async () => {
      try {
        setLoading(true);
        console.log("페이지 렌더링 시작:", currentPage);
        
        // 컨테이너가 준비될 때까지 대기
        const container = containerRef.current;
        if (!container) {
          console.log("컨테이너 없음, 다시 시도");
          setTimeout(() => {
            renderPage();
          }, 100);
          return;
        }

        const page = await pdfDocument.getPage(currentPage);
        
        // 줌 적용
        const scale = zoom / 100;
        const viewport = page.getViewport({ scale: scale });

        // 컨테이너 초기화
        container.innerHTML = "";

        // 캔버스 생성
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          console.error("Canvas context not available");
          setLoading(false);
          return;
        }

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.display = "block";

        // 페이지 렌더링
        const renderContext: any = {
          canvasContext: ctx,
          viewport: viewport,
        };

        await page.render(renderContext).promise;
        console.log("캔버스 렌더링 완료");

        // 회전 처리
        if (rotation !== 0) {
          const rotatedCanvas = document.createElement("canvas");
          const rotatedCtx = rotatedCanvas.getContext("2d");
          if (!rotatedCtx) {
            setLoading(false);
            return;
          }

          // 회전 각도에 따라 캔버스 크기 조정
          if (rotation === 90 || rotation === 270) {
            rotatedCanvas.width = canvas.height;
            rotatedCanvas.height = canvas.width;
          } else {
            rotatedCanvas.width = canvas.width;
            rotatedCanvas.height = canvas.height;
          }

          rotatedCtx.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2);
          rotatedCtx.rotate((rotation * Math.PI) / 180);
          rotatedCtx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
          rotatedCanvas.style.display = "block";

          container.appendChild(rotatedCanvas);
        } else {
          container.appendChild(canvas);
        }

        console.log("렌더링 완료");
        setLoading(false);
      } catch (error) {
        console.error("페이지 렌더링 실패:", error);
        setLoading(false);
      }
    };

    renderPage();
  }, [pdfDocument, currentPage, zoom, rotation, totalPages]);

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

  // 페이지 이동 (Clarity 추적됨)
  const goToPreviousPage = () => {
    if (currentPage > 1) {
      const newPage = currentPage - 1;
      setCurrentPage(newPage);
      setPageInput(String(newPage));
      // Clarity에 페이지 이동 기록
      if (window.clarity) {
        window.clarity("set", "page_navigation", `previous_to_${newPage}`);
      }
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      const newPage = currentPage + 1;
      setCurrentPage(newPage);
      setPageInput(String(newPage));
      // Clarity에 페이지 이동 기록
      if (window.clarity) {
        window.clarity("set", "page_navigation", `next_to_${newPage}`);
      }
    }
  };

  // 줌 컨트롤 (Clarity 추적됨)
  const handleZoomIn = () => {
    const newZoom = Math.min(zoom + 10, 200);
    setZoom(newZoom);
    if (window.clarity) {
      window.clarity("set", "zoom_level", `${newZoom}%`);
    }
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(zoom - 10, 50);
    setZoom(newZoom);
    if (window.clarity) {
      window.clarity("set", "zoom_level", `${newZoom}%`);
    }
  };

  // 회전 (Clarity 추적됨)
  const handleRotate = () => {
    const newRotation = (rotation + 90) % 360;
    setRotation(newRotation);
    if (window.clarity) {
      window.clarity("set", "page_rotation", `${newRotation}°`);
    }
  };

  // 사이드바 토글 (Clarity 추적됨)
  const handleSidebarToggle = () => {
    setSidebarOpen(!sidebarOpen);
    if (window.clarity) {
      window.clarity("set", "sidebar_toggle", sidebarOpen ? "closed" : "opened");
    }
  };

  // 썸네일 클릭 (Clarity 추적됨)
  const handleThumbnailClick = (page: number) => {
    setCurrentPage(page);
    setPageInput(String(page));
    if (window.clarity) {
      window.clarity("set", "page_navigation", `thumbnail_click_page_${page}`);
    }
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
              onClick={() => handleThumbnailClick(page)}
              className={`
                cursor-pointer rounded border-2 transition-all duration-200
                ${
                  currentPage === page
                    ? "border-[#4a9eff] bg-[#404040]"
                    : "border-[#404040] bg-[#2d2d2d] hover:border-[#505050]"
                }
                aspect-video flex items-center justify-center text-sm font-medium
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
              onClick={handleSidebarToggle}
              className="text-[#e0e0e0] hover:bg-[#505050]"
            >
              <Menu className="w-5 h-5" />
            </Button>
            <span className="text-sm font-medium ml-2 truncate">
              권민성_포트폴리오.pdf
            </span>
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
          {loading && (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-[#4a9eff]" />
              <span className="text-sm text-[#a0a0a0]">로딩 중...</span>
            </div>
          )}
          {!loading && totalPages > 0 && (
            <div className="bg-white rounded shadow-2xl overflow-hidden">
              <div
                ref={containerRef}
                className="flex items-center justify-center"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Clarity 타입 정의
declare global {
  interface Window {
    clarity?: (action: string, key: string, value: string) => void;
  }
}
