"use client";

import React, { useRef, useState } from "react";
import Webcam from "react-webcam";
import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";
import {
  Camera,
  Download,
  Trash2,
  CloudUpload,
  RotateCcw,
  FileText,
  Sun,
  Moon,
  SwitchCamera,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Wand2,
} from "lucide-react";

type Point = {
  x: number;
  y: number;
};

const DEFAULT_CORNERS: Point[] = [
  { x: 0.12, y: 0.1 },
  { x: 0.88, y: 0.1 },
  { x: 0.88, y: 0.9 },
  { x: 0.12, y: 0.9 },
];

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

const createImageFromDataUrl = (dataUrl: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Gagal memuat gambar"));
    img.src = dataUrl;
  });

const affineFromTriangles = (src: Point[], dst: Point[]) => {
  const [s0, s1, s2] = src;
  const [d0, d1, d2] = dst;

  const den =
    s0.x * (s1.y - s2.y) +
    s1.x * (s2.y - s0.y) +
    s2.x * (s0.y - s1.y);

  if (Math.abs(den) < 1e-6) return null;

  const a =
    (d0.x * (s1.y - s2.y) + d1.x * (s2.y - s0.y) + d2.x * (s0.y - s1.y)) / den;
  const c =
    (d0.x * (s2.x - s1.x) + d1.x * (s0.x - s2.x) + d2.x * (s1.x - s0.x)) / den;
  const e =
    (d0.x * (s1.x * s2.y - s2.x * s1.y) +
      d1.x * (s2.x * s0.y - s0.x * s2.y) +
      d2.x * (s0.x * s1.y - s1.x * s0.y)) /
    den;

  const b =
    (d0.y * (s1.y - s2.y) + d1.y * (s2.y - s0.y) + d2.y * (s0.y - s1.y)) / den;
  const d =
    (d0.y * (s2.x - s1.x) + d1.y * (s0.x - s2.x) + d2.y * (s1.x - s0.x)) / den;
  const f =
    (d0.y * (s1.x * s2.y - s2.x * s1.y) +
      d1.y * (s2.x * s0.y - s0.x * s2.y) +
      d2.y * (s0.x * s1.y - s1.x * s0.y)) /
    den;

  return { a, b, c, d, e, f };
};

const drawWarpedTriangle = (
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  src: Point[],
  dst: Point[]
) => {
  const transform = affineFromTriangles(src, dst);
  if (!transform) return;

  // Expand the destination triangle a bit to avoid anti-aliased seams
  // between the two triangles used for perspective correction.
  const centroid = {
    x: (dst[0].x + dst[1].x + dst[2].x) / 3,
    y: (dst[0].y + dst[1].y + dst[2].y) / 3,
  };
  const expanded = dst.map((point) => {
    const dx = point.x - centroid.x;
    const dy = point.y - centroid.y;
    const length = Math.hypot(dx, dy) || 1;
    const epsilon = 1.2;
    return {
      x: point.x + (dx / length) * epsilon,
      y: point.y + (dy / length) * epsilon,
    };
  });

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(expanded[0].x, expanded[0].y);
  ctx.lineTo(expanded[1].x, expanded[1].y);
  ctx.lineTo(expanded[2].x, expanded[2].y);
  ctx.closePath();
  ctx.clip();

  ctx.setTransform(
    transform.a,
    transform.b,
    transform.c,
    transform.d,
    transform.e,
    transform.f
  );
  ctx.drawImage(image, 0, 0);
  ctx.restore();
};

const correctPerspectiveFromCorners = async (
  sourceDataUrl: string,
  normalizedCorners: Point[]
): Promise<string> => {
  const image = await createImageFromDataUrl(sourceDataUrl);
  const src = normalizedCorners.map((point) => ({
    x: clamp01(point.x) * image.width,
    y: clamp01(point.y) * image.height,
  }));

  const top = distance(src[0], src[1]);
  const right = distance(src[1], src[2]);
  const bottom = distance(src[3], src[2]);
  const left = distance(src[0], src[3]);

  const targetWidth = Math.max(80, Math.round(Math.max(top, bottom)));
  const targetHeight = Math.max(80, Math.round(Math.max(left, right)));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) return sourceDataUrl;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, targetWidth, targetHeight);

  const dst = [
    { x: 0, y: 0 },
    { x: targetWidth, y: 0 },
    { x: targetWidth, y: targetHeight },
    { x: 0, y: targetHeight },
  ];

  drawWarpedTriangle(ctx, image, [src[0], src[1], src[3]], [dst[0], dst[1], dst[3]]);
  drawWarpedTriangle(ctx, image, [src[1], src[2], src[3]], [dst[1], dst[2], dst[3]]);

  return canvas.toDataURL("image/jpeg", 0.97);
};

export default function Scanner() {
  const webcamRef = useRef<Webcam>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const [images, setImages] = useState<string[]>([]);
  const [reviewImage, setReviewImage] = useState<string | null>(null);
  const [cornerPoints, setCornerPoints] = useState<Point[]>(() =>
    DEFAULT_CORNERS.map((point) => ({ ...point }))
  );
  const [activeCornerIndex, setActiveCornerIndex] = useState<number | null>(null);

  const [isFiltering, setIsFiltering] = useState(false);
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const toggleCamera = () => {
    setFacingMode((prevMode) => (prevMode === "user" ? "environment" : "user"));
  };

  const resetCornerPoints = () => {
    setCornerPoints(DEFAULT_CORNERS.map((point) => ({ ...point })));
  };

  const capture = () => {
    const screenshot = webcamRef.current?.getScreenshot();
    if (!screenshot) return;

    setReviewImage(screenshot);
    resetCornerPoints();
  };

  const updateCornerPosition = (clientX: number, clientY: number) => {
    if (activeCornerIndex === null || !overlayRef.current) return;

    const rect = overlayRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const x = clamp01((clientX - rect.left) / rect.width);
    const y = clamp01((clientY - rect.top) / rect.height);

    setCornerPoints((prev) =>
      prev.map((point, index) => (index === activeCornerIndex ? { x, y } : point))
    );
  };

  const applyManualCornerCorrection = async () => {
    if (!reviewImage) return;

    try {
      setIsCorrecting(true);
      const corrected = await correctPerspectiveFromCorners(reviewImage, cornerPoints);
      setReviewImage(corrected);
      resetCornerPoints();
    } catch (error) {
      console.error(error);
      alert("Gagal menerapkan 4-corner correction.");
    } finally {
      setIsCorrecting(false);
    }
  };

  const applyDocumentFilter = () => {
    if (!reviewImage) return;
    setIsFiltering(true);

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.src = reviewImage;
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      if (!ctx) {
        setIsFiltering(false);
        return;
      }

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        let color = (avg - 128) * 2.0 + 128;
        color = Math.min(255, Math.max(0, color));

        data[i] = color;
        data[i + 1] = color;
        data[i + 2] = color;
      }

      ctx.putImageData(imageData, 0, 0);
      setReviewImage(canvas.toDataURL("image/jpeg"));
      resetCornerPoints();
      setIsFiltering(false);
    };

    img.onerror = () => {
      setIsFiltering(false);
      alert("Gagal memproses filter dokumen.");
    };
  };

  const confirmImage = () => {
    if (reviewImage) {
      setImages((prev) => [...prev, reviewImage]);
      setReviewImage(null);
      setActiveCornerIndex(null);
      resetCornerPoints();
    }
  };

  const cancelReview = () => {
    setReviewImage(null);
    setActiveCornerIndex(null);
    resetCornerPoints();
  };

  const deleteImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const resetImages = () => {
    if (confirm("Yakin ingin menghapus semua halaman?")) {
      setImages([]);
    }
  };

  const moveImage = (index: number, direction: "left" | "right") => {
    const newImages = [...images];
    if (direction === "left" && index > 0) {
      [newImages[index - 1], newImages[index]] = [newImages[index], newImages[index - 1]];
      setImages(newImages);
    } else if (direction === "right" && index < images.length - 1) {
      [newImages[index + 1], newImages[index]] = [newImages[index], newImages[index + 1]];
      setImages(newImages);
    }
  };

  const handleSort = () => {
    if (
      dragItem.current !== null &&
      dragOverItem.current !== null &&
      dragItem.current !== dragOverItem.current
    ) {
      const reordered = [...images];
      const draggedItemContent = reordered.splice(dragItem.current, 1)[0];
      reordered.splice(dragOverItem.current, 0, draggedItemContent);
      setImages(reordered);
    }
    dragItem.current = null;
    dragOverItem.current = null;
  };

  const buildPDF = async () => {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const imageBytes = await fetch(img).then((res) => res.arrayBuffer());
      const jpgImage = await pdfDoc.embedJpg(imageBytes);

      const page = pdfDoc.addPage([jpgImage.width, jpgImage.height]);

      page.drawImage(jpgImage, {
        x: 0,
        y: 0,
        width: jpgImage.width,
        height: jpgImage.height,
      });

      const watermarkWord = "CAEGR\u00AE";
      const watermarkLine = Array.from({ length: 42 }, () => watermarkWord).join("   ");
      const fontSize = 8;
      const lineHeight = 13;
      const color = rgb(0.46, 0.46, 0.46);
      const opacity = 0.14;

      for (let y = -jpgImage.height; y < jpgImage.height * 2; y += lineHeight) {
        const isEvenRow = Math.floor((y + jpgImage.height) / lineHeight) % 2 === 0;
        const x = isEvenRow ? -jpgImage.width : -jpgImage.width + 70;

        page.drawText(watermarkLine, {
          x,
          y,
          size: fontSize,
          font,
          color,
          opacity,
          rotate: degrees(21),
        });
      }
    }

    return await pdfDoc.save();
  };

  const generatePDF = async () => {
    try {
      setIsProcessing(true);
      const pdfBytes = await buildPDF();
      const blob = new Blob([Uint8Array.from(pdfBytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const now = new Date();
      const fileName = `DOCFLOW_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}.pdf`;
      link.download = fileName;
      link.click();
    } catch (error) {
      console.error(error);
      alert("Gagal membuat PDF.");
    } finally {
      setIsProcessing(false);
    }
  };

  const saveToDrive = async () => {
    try {
      setIsUploading(true);
      const pdfBytes = await buildPDF();
      const now = new Date();
      const fileName = `DOCFLOW_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}.pdf`;

      const response = await fetch("/api/drive-upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pdf: Array.from(pdfBytes),
          fileName,
        }),
      });

      if (!response.ok) {
        throw new Error("Upload gagal");
      }

      const result = await response.json();
      alert(`Berhasil upload ke Google Drive. File ID: ${result.fileId}`);
    } catch (error) {
      console.error(error);
      alert("Gagal upload ke Google Drive.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={`${isDarkMode ? "dark" : ""}`}>
      <div className="min-h-screen transition-colors duration-300 bg-white dark:bg-slate-950 pb-20">
        <div className="max-w-4xl mx-auto p-4 md:p-8 flex flex-col gap-8 font-sans text-slate-800 dark:text-slate-100">
          <div className="relative text-center space-y-2">
            <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
              <FileText className="text-blue-600 dark:text-blue-400" /> DocFlow Scanner
            </h1>
            <p className="text-slate-500 dark:text-slate-400">Scan Doc and Auto Upload to Your Drive.</p>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="absolute right-0 top-0 p-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
            >
              {isDarkMode ? (
                <Sun size={20} className="text-amber-400" />
              ) : (
                <Moon size={20} className="text-slate-600" />
              )}
            </button>
          </div>

          <div className="relative mx-auto w-full max-w-2xl rounded-2xl overflow-hidden shadow-xl border-4 border-slate-100 dark:border-slate-800 bg-black">
            {reviewImage ? (
              <div className="relative w-full h-full flex flex-col items-center justify-center bg-slate-900">
                <div
                  ref={overlayRef}
                  id="review-corner-overlay"
                  className="relative w-full touch-none"
                  onPointerMove={(e) => updateCornerPosition(e.clientX, e.clientY)}
                  onPointerUp={() => setActiveCornerIndex(null)}
                  onPointerLeave={() => setActiveCornerIndex(null)}
                >
                  <img
                    src={reviewImage}
                    alt="Review Scan"
                    className={`w-full h-auto object-cover ${isFiltering || isCorrecting ? "opacity-50 blur-sm" : ""} transition-all duration-300`}
                  />

                  <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <polygon
                      points={cornerPoints.map((point) => `${point.x * 100},${point.y * 100}`).join(" ")}
                      fill="rgba(56, 189, 248, 0.12)"
                      stroke="rgba(56, 189, 248, 0.9)"
                      strokeWidth="0.6"
                      strokeDasharray="2 2"
                    />
                  </svg>

                  {cornerPoints.map((point, index) => (
                    <button
                      key={index}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        setActiveCornerIndex(index);
                      }}
                      className="absolute z-30 w-5 h-5 rounded-full bg-cyan-400 border-2 border-white shadow-md -translate-x-1/2 -translate-y-1/2 touch-none"
                      style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
                      aria-label={`Corner ${index + 1}`}
                    />
                  ))}
                </div>

                <div className="absolute bottom-6 left-0 right-0 flex justify-center items-center gap-5 px-4 z-20">
                  <button
                    onClick={cancelReview}
                    className="flex flex-col items-center gap-1 text-white hover:text-red-400 transition-colors"
                  >
                    <div className="p-3 bg-red-500/80 rounded-full backdrop-blur-sm">
                      <X size={24} />
                    </div>
                    <span className="text-xs font-medium drop-shadow-md">Batal</span>
                  </button>

                  <button
                    onClick={applyDocumentFilter}
                    disabled={isFiltering || isCorrecting}
                    className="flex flex-col items-center gap-1 text-white hover:text-blue-400 transition-colors"
                  >
                    <div className="p-4 bg-blue-600/90 rounded-full backdrop-blur-sm shadow-lg border-2 border-blue-400 hover:scale-105 active:scale-95 transition-all">
                      <Wand2 size={28} />
                    </div>
                    <span className="text-xs font-medium drop-shadow-md">
                      {isFiltering ? "Filtering..." : "Efek CamScanner"}
                    </span>
                  </button>

                  <button
                    onClick={applyManualCornerCorrection}
                    disabled={isCorrecting || isFiltering}
                    className="flex flex-col items-center gap-1 text-white hover:text-emerald-400 transition-colors"
                  >
                    <div className="p-3 bg-emerald-500/80 rounded-full backdrop-blur-sm">
                      <Camera size={24} />
                    </div>
                    <span className="text-xs font-medium drop-shadow-md">
                      {isCorrecting ? "Correcting..." : "Apply 4-Corner"}
                    </span>
                  </button>

                  <button
                    onClick={confirmImage}
                    className="flex flex-col items-center gap-1 text-white hover:text-green-400 transition-colors"
                  >
                    <div className="p-3 bg-green-500/80 rounded-full backdrop-blur-sm">
                      <Check size={24} />
                    </div>
                    <span className="text-xs font-medium drop-shadow-md">Simpan</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                <Webcam
                  audio={false}
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  videoConstraints={{ facingMode }}
                  className="w-full h-auto object-cover opacity-95 transition-opacity duration-300 hover:opacity-100"
                />
                <button
                  onClick={toggleCamera}
                  className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 backdrop-blur-sm transition-all shadow-md z-10"
                >
                  <SwitchCamera size={24} />
                </button>
                <div className="absolute bottom-6 left-0 right-0 flex justify-center z-10">
                  <button
                    onClick={capture}
                    className="flex items-center justify-center w-16 h-16 bg-white rounded-full shadow-lg border-4 border-slate-200 hover:scale-105 active:scale-95 transition-all"
                  >
                    <Camera className="text-slate-800" size={28} />
                  </button>
                </div>
              </>
            )}
          </div>

          {images.length > 0 && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 gap-4">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-medium">
                  <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 py-1 px-3 rounded-full text-sm">
                    {images.length} Halaman
                  </span>
                  siap diproses
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={resetImages}
                    disabled={isProcessing}
                    className="flex items-center gap-2 text-red-600 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-lg text-sm font-medium"
                  >
                    <RotateCcw size={16} /> Reset
                  </button>
                  <button
                    onClick={generatePDF}
                    disabled={isProcessing}
                    className="flex items-center gap-2 bg-slate-800 text-white hover:bg-slate-700 px-4 py-2 rounded-lg text-sm font-medium"
                  >
                    <Download size={16} /> Download
                  </button>
                  <button
                    onClick={saveToDrive}
                    disabled={isProcessing || isUploading}
                    className="flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-medium"
                  >
                    <CloudUpload size={16} /> {isUploading ? "Uploading..." : "Save to Drive"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {images.map((img, index) => (
                  <div
                    key={index}
                    draggable
                    onDragStart={() => (dragItem.current = index)}
                    onDragEnter={() => (dragOverItem.current = index)}
                    onDragEnd={handleSort}
                    onDragOver={(e) => e.preventDefault()}
                    className="relative group rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-700 aspect-[3/4] bg-slate-50 dark:bg-slate-800 flex flex-col"
                  >
                    <div className="flex-1 relative overflow-hidden">
                      <img src={img} alt={`Hal ${index + 1}`} className="w-full h-full object-cover" />
                      <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                        Hal {index + 1}
                      </div>
                      <button
                        onClick={() => deleteImage(index)}
                        className="absolute top-2 right-2 bg-red-500/90 text-white p-1.5 rounded-full hover:bg-red-600 md:opacity-0 md:group-hover:opacity-100"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="flex bg-slate-100 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
                      <button
                        onClick={() => moveImage(index, "left")}
                        disabled={index === 0}
                        className="flex-1 py-2 flex justify-center text-slate-600 hover:bg-slate-200 disabled:opacity-30"
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <div className="w-px bg-slate-200 dark:bg-slate-700"></div>
                      <button
                        onClick={() => moveImage(index, "right")}
                        disabled={index === images.length - 1}
                        className="flex-1 py-2 flex justify-center text-slate-600 hover:bg-slate-200 disabled:opacity-30"
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
