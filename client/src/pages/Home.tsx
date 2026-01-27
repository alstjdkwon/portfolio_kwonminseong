import { useState, useEffect } from "react";
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
  const [pageInput, setPageInput] = useState("1");
  const [thumbnails, setThumbnails] = useState<{ [key: number]: string }>({});

  // PDF 로드
  useEffect(() => {
    const loadPdf = async () => {
      try {
        setLoading(true);
        const pdf = await pdfjsLib.getDocument("/portfolio.pdf").promise;
        setPdfDocument(pdf);
        setTotalPages(pdf.numPages);
        console.log("PDF 로드 완료:", pdf.numPages, "페이지");
        
        // 썸네일 생성
        generateThumbnails(pdf);
      } catch (error) {
        console.error("PDF 로드 실패:", error);
      } finally {
        setLoading(false);
      }
    };
    loadPdf();
  }, []);

  // 썸네일 생성
  const generateThumbnails = async (pdf: pdfjsLib.PDFDocumentProxy) => {
    const thumbs: { [key: number]: string } = {};
    
    for (let i = 1; i <= Math.min(pdf.numPages, 28); i++) {
      try {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 0.2 }); // 작은 크기로 생성
        
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        
        const renderContext: any = {
          canvasContext: ctx,
          viewport: viewport,
        };
        
        await page.render(renderContext).promise;
        thumbs[i] = canvas.toDataURL("image/png");
      } catch (error) {
        console.error(`썸네일 생성 실패 (페이지 ${i}):`, error);
      }
    }
    
    setThumbnails(thumbs);
  };

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
        
        // DOM 렌더링 완료 대기
        await new Promise(resolve => setTimeout(resolve, 150));
        
        const container = document.getElementById("pdf-container");
        const viewer = document.getElementById("pdf-viewer");
        
        if (!container || !viewer) {
          console.error("컨테이너 또는 뷰어 없음", { container: !!container, viewer: !!viewer });
          setLoading(false);
          return;
        }

        console.log("DOM 요소 확인됨:", { container: !!container, viewer: !!viewer });

        // 기존 캔버스 제거
        container.innerHTML = "";

        const page = await pdfDocument.getPage(currentPage);
        
        // 뷰어 영역 크기 사용
        const maxWidth = viewer.clientWidth - 32; // p-4 = 16px * 2
        const maxHeight = viewer.clientHeight - 32;
        
        console.log("뷰어 영역 크기:", { maxWidth, maxHeight, viewerWidth: viewer.clientWidth, viewerHeight: viewer.clientHeight });
        
        // 1920x1080 페이지를 뷰포트에 맞게 스케일링
        const pageWidth = 1920;
        const pageHeight = 1080;
        const scaleToFit = Math.min(maxWidth / pageWidth, maxHeight / pageHeight) * 0.95;
        
        // 줌 적용
        const scale = (zoom / 100) * scaleToFit;
        const viewport = page.getViewport({ scale: scale });

        console.log("뷰포트 크기:", { width: viewport.width, height: viewport.height, scale, scaleToFit });

        // 캔버스 생성
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.backgroundColor = "#f0f0f0";
        canvas.style.border = "1px solid #ccc";
        canvas.style.display = "block";
        
        console.log("캔버스 생성:", { width: canvas.width, height: canvas.height });

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          console.error("Canvas context not available");
          setLoading(false);
          return;
        }

        // 페이지 렌더링
        const renderContext: any = {
          canvasContext: ctx,
          viewport: viewport,
        };

        console.log("렌더링 시작");
        await page.render(renderContext).promise;
        console.log("렌더링 완료");
        
        // 컨테이너에 캔버스 추가
        container.appendChild(canvas);
        console.log("캔버스 DOM에 추가됨");
        
        // 컨테이너 크기를 캔버스 크기에 맞게 조정
        container.style.width = `${canvas.width}px`;
        container.style.height = `${canvas.height}px`;
        console.log("컨테이너 크기 조정:", { width: canvas.width, height: canvas.height });
        
        setLoading(false);
      } catch (error) {
        console.error("페이지 렌더링 실패:", error);
        setLoading(false);
      }
    };

    renderPage();
  }, [pdfDocument, currentPage, zoom, totalPages]);

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
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <div
              key={page}
              onClick={() => handleThumbnailClick(page)}
              className={`
                cursor-pointer rounded transition-all duration-200 flex flex-col items-center gap-2
                ${
                  currentPage === page
                    ? "ring-2 ring-[#4a9eff]"
                    : "hover:opacity-80"
                }
              `}
            >
              {/* 페이지 미리보기 */}
              <div className="w-full aspect-video bg-[#2d2d2d] rounded border border-[#404040] overflow-hidden">
                {thumbnails[page] ? (
                  <img
                    src={thumbnails[page]}
                    alt={`Page ${page}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Loader2 className="w-4 h-4 animate-spin text-[#4a9eff]" />
                  </div>
                )}
              </div>
              {/* 페이지 번호 */}
              <span className="text-xs text-[#a0a0a0] font-medium">{page}</span>
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
        <div id="pdf-viewer" className="flex-1 overflow-auto bg-[#1a1a1a] flex items-center justify-center p-4">
          {loading && (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-[#4a9eff]" />
              <span className="text-sm text-[#a0a0a0]">로딩 중...</span>
            </div>
          )}
          <div 
            id="pdf-container"
            className="bg-white rounded shadow-2xl"
            style={{
              transform: `rotate(${rotation}deg)`,
              transformOrigin: "center",
              width: "auto",
              height: "auto",
            }}
          />
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
