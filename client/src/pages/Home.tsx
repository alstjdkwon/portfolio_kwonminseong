"use client";
import { Button } from "@/components/ui/button";
import { Menu, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw, Download, Loader2 } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import { useEffect, useState, useRef } from "react";

// PDF.js worker 설정
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

export default function Home() {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [zoom, setZoom] = useState(60);
  const [rotation, setRotation] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [prerenderedPages, setPrerenderedPages] = useState<{ [key: number]: string }>({});
  const [thumbnails, setThumbnails] = useState<{ [key: number]: string }>({});
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [pageInput, setPageInput] = useState("1");
  const [pdfDocument, setPdfDocument] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageAnnotations, setPageAnnotations] = useState<{ [key: number]: any[] }>({});
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const linkOverlayRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastScrollTimeRef = useRef(0);

  // PDF 로드 및 렌더링
  useEffect(() => {
    const loadPDF = async () => {
      try {
        setIsRendering(true);
        const pdf = await pdfjsLib.getDocument("/Portfolio.pdf").promise;
        setTotalPages(pdf.numPages);
        setPdfDocument(pdf);

        // 썸네일 생성
        generateThumbnails(pdf);

        // 모든 페이지의 어노테이션(링크) 추출
        await extractAllAnnotations(pdf);

        // 모든 페이지 미리 렌더링 (병렬 처리)
        await preRenderAllPages(pdf);

        setIsRendering(false);
      } catch (error) {
        console.error("PDF 로드 실패:", error);
        setIsRendering(false);
      }
    };

    loadPDF();
  }, []);

  // 모든 페이지의 어노테이션 추출
  const extractAllAnnotations = async (pdf: pdfjsLib.PDFDocumentProxy) => {
    const annotations: { [key: number]: any[] } = {};

    for (let i = 1; i <= pdf.numPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const annots = await page.getAnnotations();
        annotations[i] = annots.filter((a: any) => a.subtype === "Link");
      } catch (error) {
        console.error(`어노테이션 추출 실패 (페이지 ${i}):`, error);
        annotations[i] = [];
      }
    }

    setPageAnnotations(annotations);
  };

  // 썸네일 생성
  const generateThumbnails = async (pdf: pdfjsLib.PDFDocumentProxy) => {
    const thumbs: { [key: number]: string } = {};

    for (let i = 1; i <= pdf.numPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 0.15 });

        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const ctx = canvas.getContext("2d");
        if (!ctx) continue;

        await page.render({
          canvasContext: ctx,
          viewport: viewport,
        } as any).promise;

        thumbs[i] = canvas.toDataURL("image/png");
      } catch (error) {
        console.error(`썸네일 생성 실패 (페이지 ${i}):`, error);
      }
    }

    setThumbnails(thumbs);
  };

  // Canvas로 PDF 페이지 렌더링
  const renderPageToCanvas = async (pdf: pdfjsLib.PDFDocumentProxy, pageNum: number, canvas: HTMLCanvasElement) => {
    try {
      const page = await pdf.getPage(pageNum);

      // 처음 렌더링을 위한 viewport 계산
      const initialViewport = page.getViewport({ scale: 1 });
      const maxWidth = window.innerWidth * 0.7;
      const maxHeight = window.innerHeight * 0.85;
      const scaleToFit = Math.min(maxWidth / initialViewport.width, maxHeight / initialViewport.height) * 0.95;

      const dpiScale = 2;
      const scale = (zoom / 100) * scaleToFit * dpiScale;
      const viewport = page.getViewport({ scale: scale });

      // Canvas 크기 설정
      const canvasWidth = Math.max(Math.ceil(viewport.width), 1);
      const canvasHeight = Math.max(Math.ceil(viewport.height), 1);
      const MAX_CANVAS_SIZE = 32767;

      if (canvasWidth > MAX_CANVAS_SIZE || canvasHeight > MAX_CANVAS_SIZE) {
        console.warn(`Canvas 크기 초과 (페이지 ${pageNum}): ${canvasWidth}x${canvasHeight}`);
        return;
      }

      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      canvas.style.backgroundColor = "#f0f0f0";

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      const renderContext: any = {
        canvasContext: ctx,
        viewport: viewport,
      };

      await page.render(renderContext).promise;
    } catch (error) {
      console.error(`Canvas 렌더링 실패 (페이지 ${pageNum}):`, error);
    }
  };

  // 링크 오버레이 업데이트
  useEffect(() => {
    if (!pdfDocument || !pageAnnotations[currentPage] || !linkOverlayRef.current) return;

    const updateLinkOverlay = async () => {
      try {
        const overlay = linkOverlayRef.current;
        if (!overlay) return;
        overlay.innerHTML = "";

        const annotations = pageAnnotations[currentPage] || [];
        if (annotations.length === 0) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        // PDF 원본 페이지의 viewport (scale=1)에서 실제 PDF 좌표계 크기를 가져옴
        const page = await pdfDocument.getPage(currentPage);
        const pdfViewport = page.getViewport({ scale: 1 });
        const pdfWidth = pdfViewport.width;
        const pdfHeight = pdfViewport.height;

        // Canvas의 화면 표시 크기 (CSS 픽셀)
        const displayRect = canvas.getBoundingClientRect();
        const scaleX = displayRect.width / pdfWidth;
        const scaleY = displayRect.height / pdfHeight;

        annotations.forEach((annot: any) => {
          if (!annot.rect) return;

          // PDF 좌표: 왼쪽 하단 원점, [x1, y1, x2, y2]
          const [x1, y1, x2, y2] = annot.rect;

          // PDF 좌표계(왼쪽 하단 원점) → CSS 좌표계(왼쪽 상단 원점) 변환
          const cssLeft = x1 * scaleX;
          const cssTop = (pdfHeight - y2) * scaleY;
          const cssWidth = (x2 - x1) * scaleX;
          const cssHeight = (y2 - y1) * scaleY;

          const linkElement = document.createElement("a");

          // 외부 URL 링크
          if (annot.url) {
            linkElement.href = annot.url;
            linkElement.target = "_blank";
            linkElement.rel = "noopener noreferrer";
          }

          linkElement.style.cssText = `
            position: absolute;
            left: ${cssLeft}px;
            top: ${cssTop}px;
            width: ${cssWidth}px;
            height: ${cssHeight}px;
            cursor: pointer;
            opacity: 0;
            z-index: 10;
          `;

          linkElement.addEventListener("click", (e) => {
            // 내부 페이지 이동 링크 처리
            if (annot.dest && !annot.url) {
              e.preventDefault();
              pdfDocument.getDestination(annot.dest).then((dest: any) => {
                if (dest) {
                  pdfDocument.getPageIndex(dest[0]).then((pageIndex: number) => {
                    const targetPage = pageIndex + 1;
                    setCurrentPage(targetPage);
                    setPageInput(String(targetPage));
                  });
                }
              });
            }
            if (window.clarity) {
              window.clarity("set", "link_click", `page_${currentPage}_url_${annot.url || annot.dest}`);
            }
          });

          overlay.appendChild(linkElement);
        });
      } catch (error) {
        console.error("링크 오버레이 업데이트 실패:", error);
      }
    };

    updateLinkOverlay();
  }, [currentPage, zoom, pageAnnotations, pdfDocument]);

  // Canvas로 현재 페이지 렌더링
  useEffect(() => {
    if (!pdfDocument || !canvasRef.current) return;

    renderPageToCanvas(pdfDocument, currentPage, canvasRef.current);
  }, [currentPage, zoom, pdfDocument]);

  // 병렬 렌더링 헬퍼 함수 (DataURL로 변환을 위한 레거시)
  const renderPageToDataURL = async (pdf: pdfjsLib.PDFDocumentProxy, pageNum: number) => {
    try {
      const page = await pdf.getPage(pageNum);

      const initialViewport = page.getViewport({ scale: 1 });
      const maxWidth = window.innerWidth * 0.7;
      const maxHeight = window.innerHeight * 0.85;
      const scaleToFit = Math.min(maxWidth / initialViewport.width, maxHeight / initialViewport.height) * 0.95;

      const dpiScale = 2;
      const scale = (zoom / 100) * scaleToFit * dpiScale;
      const viewport = page.getViewport({ scale: scale });

      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.backgroundColor = "#f0f0f0";

      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      const renderContext: any = {
        canvasContext: ctx,
        viewport: viewport,
      };

      await page.render(renderContext).promise;
      return canvas.toDataURL("image/png");
    } catch (error) {
      console.error(`페이지 ${pageNum} 렌더링 실패:`, error);
      return null;
    }
  };

  // 모든 페이지 미리 렌더링 (병렬 처리)
  const preRenderAllPages = async (pdf: pdfjsLib.PDFDocumentProxy) => {
    const prerendered: { [key: number]: string } = {};
    const concurrency = 4; // 동시에 4개 페이지 렌더링

    for (let i = 1; i <= pdf.numPages; i += concurrency) {
      // 4개씩 묶어서 병렬 렌더링
      const batch = [];
      for (let j = 0; j < concurrency && i + j <= pdf.numPages; j++) {
        batch.push(renderPageToDataURL(pdf, i + j));
      }

      const results = await Promise.all(batch);
      results.forEach((dataUrl, idx) => {
        if (dataUrl) {
          prerendered[i + idx] = dataUrl;
        }
      });

      // 진행률 업데이트
      const completed = Math.min(i + concurrency - 1, pdf.numPages);
      setRenderProgress(Math.round((completed / pdf.numPages) * 100));
      console.log(`페이지 ${i}~${completed} 렌더링 완료 (${Math.round((completed / pdf.numPages) * 100)}%)`);
    }

    setPrerenderedPages(prerendered);
    setRenderProgress(100);
    console.log("모든 페이지 렌더링 완료");
  };

  // 페이지 입력 처리
  const handlePageInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPageInput(value);

    const pageNum = parseInt(value);
    if (pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
      if (window.clarity) {
        window.clarity("set", "page_navigation", `input_page_${pageNum}`);
      }
    }
  };

  // 스크롤 이벤트
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      const now = Date.now();
      if (now - lastScrollTimeRef.current < 300) return;
      lastScrollTimeRef.current = now;

      if (e.deltaY > 0) {
        goToNextPage();
      } else if (e.deltaY < 0) {
        goPreviousPage();
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: true });
    return () => window.removeEventListener("wheel", handleWheel);
  }, [currentPage, totalPages]);

  // 키보드 이벤트
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target === document.querySelector("input[type='number']")) return;

      if (e.key === "ArrowRight") {
        goToNextPage();
      } else if (e.key === "ArrowLeft") {
        goPreviousPage();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentPage, totalPages]);

  // 페이지 이동
  const goPreviousPage = () => {
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

  // 줌 컨트롤
  const handleZoomIn = () => {
    const newZoom = Math.min(zoom + 10, 300);
    setZoom(newZoom);
    if (window.clarity) {
      window.clarity("set", "zoom_level", `${newZoom}%`);
    }
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(zoom - 10, 25);
    setZoom(newZoom);
    if (window.clarity) {
      window.clarity("set", "zoom_level", `${newZoom}%`);
    }
  };

  // 회전
  const handleRotate = () => {
    const newRotation = (rotation + 90) % 360;
    setRotation(newRotation);
    if (window.clarity) {
      window.clarity("set", "page_rotation", `${newRotation}°`);
    }
  };

  // 사이드바 토글
  const handleSidebarToggle = () => {
    setSidebarOpen(!sidebarOpen);
    if (window.clarity) {
      window.clarity("set", "sidebar_toggle", sidebarOpen ? "closed" : "opened");
    }
  };

  // 썸네일 클릭
  const handleThumbnailClick = (page: number) => {
    setCurrentPage(page);
    setPageInput(String(page));
    if (window.clarity) {
      window.clarity("set", "page_navigation", `thumbnail_click_page_${page}`);
    }
  };

  return (
    <div className="h-screen w-screen flex bg-[#1a1a1a] text-[#e0e0e0]">
      {/* 사이드바 */}
      <div
        className={`transition-all duration-300 ease-in-out ${sidebarOpen ? "w-48" : "w-0"
          } bg-[#1a1a1a] border-r border-[#404040] overflow-hidden flex flex-col`}
      >
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <div
              key={page}
              onClick={() => handleThumbnailClick(page)}
              className={`
                cursor-pointer rounded transition-all duration-200 flex flex-col items-center gap-2
                ${currentPage === page
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

            <span className="text-sm text-[#a0a0a0] ml-2">권민성_포트폴리오.pdf</span>
          </div>

          {/* 중앙: 페이지 네비게이션 */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={goPreviousPage}
              disabled={currentPage === 1}
              className="text-[#e0e0e0] hover:bg-[#505050] disabled:opacity-50"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>

            <div className="flex items-center gap-1">
              <input
                type="number"
                min="1"
                max={totalPages}
                value={pageInput}
                onChange={handlePageInput}
                className="w-12 text-center bg-[#2d2d2d] text-[#e0e0e0] border border-[#404040] rounded px-2 py-1 text-sm"
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

          {/* 오른쪽: 줌 및 컨트롤 */}
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

        {/* 렌더링 진행률 표시 */}
        {isRendering && (
          <div className="bg-[#2d2d2d] border-b border-[#404040] px-4 py-2">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#4a9eff]" />
              <span className="text-sm text-[#a0a0a0]">
                페이지 렌더링 중... {renderProgress}%
              </span>
              <div className="flex-1 bg-[#404040] rounded-full h-1">
                <div
                  className="bg-[#4a9eff] h-1 rounded-full transition-all duration-300"
                  style={{ width: `${renderProgress}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* 메인 뷰어 영역 */}
        <div id="pdf-viewer" className="flex-1 overflow-auto bg-[#1a1a1a] flex items-center justify-center p-4">
          <div
            ref={containerRef}
            className="bg-white rounded shadow-2xl relative"
            style={{
              transform: `rotate(${rotation}deg)`,
              transformOrigin: "center",
              width: "auto",
              height: "auto",
            }}
          >
            {pdfDocument ? (
              <>
                <canvas
                  ref={canvasRef}
                  className="block"
                  style={{
                    maxWidth: "100%",
                    maxHeight: "100%",
                    imageRendering: "crisp-edges",
                  }}
                />
                {/* 링크 오버레이 */}
                <div
                  ref={linkOverlayRef}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                  }}
                />
              </>
            ) : (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin text-[#4a9eff]" />
              </div>
            )}
          </div>
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
