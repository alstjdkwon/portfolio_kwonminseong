import { Menu, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw, Download, Loader2 } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import { useEffect, useState, useRef } from "react";

// PDF.js worker 설정
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

export default function Home() {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [prerenderedPages, setPrerenderedPages] = useState<{ [key: number]: string }>({});
  const [thumbnails, setThumbnails] = useState<{ [key: number]: string }>({});
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [pageInput, setPageInput] = useState("1");
  const [pdfDocument, setPdfDocument] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageAnnotations, setPageAnnotations] = useState<{ [key: number]: any[] }>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const lastScrollTimeRef = useRef(0);
  const linkOverlayRef = useRef<HTMLDivElement>(null);

  // PDF 로드 및 렌더링
  useEffect(() => {
    const loadPDF = async () => {
      try {
        setIsRendering(true);
        const pdf = await pdfjsLib.getDocument("/portfolio.pdf").promise;
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

  // 병렬 렌더링 헬퍼 함수
  const renderPageToDataURL = async (pdf: pdfjsLib.PDFDocumentProxy, pageNum: number) => {
    try {
      const page = await pdf.getPage(pageNum);
      
      const pageWidth = 1920;
      const pageHeight = 1080;
      const maxWidth = window.innerWidth * 0.7;
      const maxHeight = window.innerHeight * 0.85;
      const scaleToFit = Math.min(maxWidth / pageWidth, maxHeight / pageHeight) * 0.95;
      
      const dpiScale = 2;
      const scale = (zoom / 100) * scaleToFit * dpiScale;
      const viewport = page.getViewport({ scale: scale });

      // 캔버스 크기 검증 - 최소 크기 설정
      const canvasWidth = Math.max(Math.ceil(viewport.width), 1);
      const canvasHeight = Math.max(Math.ceil(viewport.height), 1);
      
      // 캔버스 최대 크기 제한 (브라우저 제한)
      const MAX_CANVAS_SIZE = 32767;
      if (canvasWidth > MAX_CANVAS_SIZE || canvasHeight > MAX_CANVAS_SIZE) {
        console.warn(`캔버스 크기 초과 (페이지 ${pageNum}): ${canvasWidth}x${canvasHeight}`);
        return null;
      }

      const canvas = document.createElement("canvas");
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      canvas.style.backgroundColor = "#f0f0f0";
      
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
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
    }
  };

  // 페이지 입력 확인
  const handlePageInputBlur = () => {
    const pageNum = parseInt(pageInput);
    if (isNaN(pageNum) || pageNum < 1 || pageNum > totalPages) {
      setPageInput(currentPage.toString());
    }
  };

  // 다음 페이지
  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
      setPageInput((currentPage + 1).toString());
    }
  };

  // 이전 페이지
  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
      setPageInput((currentPage - 1).toString());
    }
  };

  // 줌 인
  const handleZoomIn = () => {
    setZoom(Math.min(zoom + 10, 300));
  };

  // 줌 아웃
  const handleZoomOut = () => {
    setZoom(Math.max(zoom - 10, 25));
  };

  // 회전
  const handleRotate = () => {
    setRotation((rotation + 90) % 360);
  };

  // 다운로드
  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = "/portfolio.pdf";
    link.download = "portfolio.pdf";
    link.click();
  };

  // 휠 스크롤 이벤트
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      const now = Date.now();
      if (now - lastScrollTimeRef.current < 300) return;
      lastScrollTimeRef.current = now;

      if (e.deltaY > 0) {
        nextPage();
      } else if (e.deltaY < 0) {
        prevPage();
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: true });
    return () => window.removeEventListener("wheel", handleWheel);
  }, [currentPage, totalPages]);

  // 키보드 이벤트
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      if (e.key === "ArrowRight") {
        setCurrentPage((prev) => Math.min(prev + 1, totalPages));
        setPageInput((prev) => {
          const next = Math.min(parseInt(prev) + 1, totalPages);
          return next.toString();
        });
      } else if (e.key === "ArrowLeft") {
        setCurrentPage((prev) => Math.max(prev - 1, 1));
        setPageInput((prev) => {
          const next = Math.max(parseInt(prev) - 1, 1);
          return next.toString();
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [totalPages]);

  // 링크 오버레이 업데이트
  useEffect(() => {
    if (!linkOverlayRef.current || !pdfDocument) return;

    const updateLinkOverlay = async () => {
      const overlay = linkOverlayRef.current;
      if (!overlay) return;

      // 기존 링크 제거
      overlay.innerHTML = "";

      const annotations = pageAnnotations[currentPage] || [];
      if (annotations.length === 0) return;

      try {
        const page = await pdfDocument.getPage(currentPage);
        const pageWidth = 1920;
        const pageHeight = 1080;
        const maxWidth = window.innerWidth * 0.7;
        const maxHeight = window.innerHeight * 0.85;
        const scaleToFit = Math.min(maxWidth / pageWidth, maxHeight / pageHeight) * 0.95;
        const dpiScale = 2;
        const scale = (zoom / 100) * scaleToFit * dpiScale;
        const viewport = page.getViewport({ scale: scale });

        // 각 링크에 대해 오버레이 생성
        for (const annot of annotations) {
          if (annot.subtype !== "Link") continue;

          const rect = annot.rect;
          if (!rect) continue;

          // PDF 좌표를 스크린 좌표로 변환
          const [x1, y1, x2, y2] = rect;
          const pageHeight_pdf = viewport.height / scale;
          
          const screenX1 = (x1 / pageWidth) * viewport.width;
          const screenY1 = ((pageHeight_pdf - y2) / pageHeight_pdf) * viewport.height;
          const screenX2 = (x2 / pageWidth) * viewport.width;
          const screenY2 = ((pageHeight_pdf - y1) / pageHeight_pdf) * viewport.height;

          const linkElement = document.createElement("a");
          linkElement.style.position = "absolute";
          linkElement.style.left = `${screenX1}px`;
          linkElement.style.top = `${screenY1}px`;
          linkElement.style.width = `${screenX2 - screenX1}px`;
          linkElement.style.height = `${screenY2 - screenY1}px`;
          linkElement.style.cursor = "pointer";
          linkElement.style.zIndex = "10";

          // 링크 대상 설정
          if (annot.url) {
            linkElement.href = annot.url;
            linkElement.target = "_blank";
            linkElement.rel = "noopener noreferrer";
          } else if (annot.dest) {
            // 내부 링크는 일단 무시 (필요시 구현 가능)
            linkElement.style.cursor = "default";
          }

          overlay.appendChild(linkElement);
        }
      } catch (error) {
        console.error("링크 오버레이 업데이트 실패:", error);
      }
    };

    updateLinkOverlay();
  }, [currentPage, zoom, pageAnnotations, pdfDocument]);

  return (
    <div className="min-h-screen bg-[#2a2a2a] flex">
      {/* 사이드바 */}
      <div
        className={`${
          sidebarOpen ? "w-48" : "w-0"
        } bg-[#1a1a1a] overflow-y-auto transition-all duration-300 border-r border-[#444]`}
      >
        <div className="p-2 space-y-2">
          {Array.from({ length: totalPages }).map((_, i) => (
            <div key={i + 1} className="cursor-pointer" onClick={() => {
              setCurrentPage(i + 1);
              setPageInput((i + 1).toString());
            }}>
              <div
                className={`rounded border-2 overflow-hidden ${
                  currentPage === i + 1 ? "border-blue-500" : "border-[#444]"
                }`}
              >
                {thumbnails[i + 1] && (
                  <img
                    src={thumbnails[i + 1]}
                    alt={`Page ${i + 1}`}
                    className="w-full h-auto"
                  />
                )}
              </div>
              <p className="text-center text-white text-sm mt-1">{i + 1}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="flex-1 flex flex-col">
        {/* 상단 도구 모음 */}
        <div className="bg-[#3a3a3a] border-b border-[#555] px-4 py-3 flex items-center gap-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-[#4a4a4a] rounded"
          >
            <Menu size={20} className="text-white" />
          </button>

          <button onClick={prevPage} className="p-2 hover:bg-[#4a4a4a] rounded">
            <ChevronLeft size={20} className="text-white" />
          </button>

          <div className="flex items-center gap-2">
            <input
              type="number"
              value={pageInput}
              onChange={handlePageInput}
              onBlur={handlePageInputBlur}
              className="w-12 px-2 py-1 bg-[#2a2a2a] text-white border border-[#555] rounded text-center"
              min="1"
              max={totalPages}
            />
            <span className="text-white text-sm">/ {totalPages}</span>
          </div>

          <button onClick={nextPage} className="p-2 hover:bg-[#4a4a4a] rounded">
            <ChevronRight size={20} className="text-white" />
          </button>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <span className="text-white text-sm">{zoom}%</span>
            <button onClick={handleZoomOut} className="p-2 hover:bg-[#4a4a4a] rounded">
              <ZoomOut size={20} className="text-white" />
            </button>
            <button onClick={handleZoomIn} className="p-2 hover:bg-[#4a4a4a] rounded">
              <ZoomIn size={20} className="text-white" />
            </button>
          </div>

          <button onClick={handleRotate} className="p-2 hover:bg-[#4a4a4a] rounded">
            <RotateCw size={20} className="text-white" />
          </button>

          <button onClick={handleDownload} className="p-2 hover:bg-[#4a4a4a] rounded">
            <Download size={20} className="text-white" />
          </button>
        </div>

        {/* 뷰어 영역 */}
        <div className="flex-1 bg-[#1a1a1a] flex items-center justify-center p-4 overflow-hidden">
          {isRendering && renderProgress < 100 && (
            <div className="text-center">
              <Loader2 className="animate-spin text-blue-500 mb-4 mx-auto" size={40} />
              <p className="text-white">페이지 렌더링 중... {renderProgress}%</p>
            </div>
          )}

          {!isRendering && prerenderedPages[currentPage] && (
            <div
              ref={containerRef}
              className="relative"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: "transform 0.2s ease",
              }}
            >
              <img
                src={prerenderedPages[currentPage]}
                alt={`Page ${currentPage}`}
                className="rounded shadow-2xl"
                style={{
                  imageRendering: "crisp-edges",
                  maxWidth: "100%",
                  maxHeight: "100%",
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
