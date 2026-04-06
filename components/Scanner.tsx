"use client";

import React, { useRef, useState } from "react";
import Webcam from "react-webcam";
import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";
import { 
  Camera, Download, Trash2, CloudUpload, RotateCcw, 
  FileText, Sun, Moon, SwitchCamera, ChevronLeft, 
  ChevronRight, Check, X, Wand2 
} from "lucide-react";

export default function Scanner() {
  const webcamRef = useRef<Webcam>(null);
  const [images, setImages] = useState<string[]>([]);
  
  // State baru untuk Mode Review & Filter
  const [reviewImage, setReviewImage] = useState<string | null>(null);
  const [isFiltering, setIsFiltering] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const toggleCamera = () => {
    setFacingMode((prevMode) => (prevMode === "user" ? "environment" : "user"));
  };

  // 1. Ambil foto dan masuk ke Mode Review
  const capture = () => {
    const screenshot = webcamRef.current?.getScreenshot();
    if (screenshot) setReviewImage(screenshot);
  };

  // 2. Terapkan algoritma Computer Vision (Grayscale + High Contrast) via Canvas
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
      if (!ctx) return;

      // Gambar foto asli ke canvas
      ctx.drawImage(img, 0, 0);

      // Ambil data piksel gambar
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Proses Thresholding & Contrast (Memutihkan kertas, menghitamkan teks)
      for (let i = 0; i < data.length; i += 4) {
        // Ubah ke Grayscale (R+G+B / 3)
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        
        // Tingkatkan Kontras (Rumus sederhana pemrosesan citra)
        let color = (avg - 128) * 2.0 + 128; // Faktor kontras 2.0
        
        // Batasi nilai agar tetap di rentang RGB (0 - 255)
        color = Math.min(255, Math.max(0, color));

        // Terapkan warna baru ke piksel RGB
        data[i] = color;     // Red
        data[i + 1] = color; // Green
        data[i + 2] = color; // Blue
      }

      // Kembalikan piksel yang sudah diproses ke canvas
      ctx.putImageData(imageData, 0, 0);
      
      // Simpan hasil filter ke state review
      setReviewImage(canvas.toDataURL("image/jpeg"));
      setIsFiltering(false);
    };
  };

  // 3. Simpan gambar dari Mode Review ke Galeri
  const confirmImage = () => {
    if (reviewImage) {
      setImages((prev) => [...prev, reviewImage]);
      setReviewImage(null); // Tutup mode review
    }
  };

  // Batal simpan gambar
  const cancelReview = () => {
    setReviewImage(null);
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
      const _images = [...images];
      const draggedItemContent = _images.splice(dragItem.current, 1)[0];
      _images.splice(dragOverItem.current, 0, draggedItemContent);
      setImages(_images);
    }
    dragItem.current = null;
    dragOverItem.current = null;
  };

  // Logika Watermark & Build PDF tetap sama...
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

      const watermarkText = "DOCFLOW WATERMARK";
      const fontSize = 18;
      const stepX = 250;
      const stepY = 250;

      for (let x = -jpgImage.width; x < jpgImage.width * 2; x += stepX) {
        for (let y = -jpgImage.height; y < jpgImage.height * 2; y += stepY) {
          page.drawText(watermarkText, {
            x: x,
            y: y,
            size: fontSize,
            font,
            color: rgb(0.5, 0.5, 0.5),
            opacity: 0.15,
            rotate: degrees(45),
          });
        }
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
              {isDarkMode ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} className="text-slate-600" />}
            </button>
          </div>

          {/* AREA KAMERA / MODE REVIEW */}
          <div className="relative mx-auto w-full max-w-2xl rounded-2xl overflow-hidden shadow-xl border-4 border-slate-100 dark:border-slate-800 bg-black">
            
            {/* JIKA SEDANG MODE REVIEW GAMBAR */}
            {reviewImage ? (
              <div className="relative w-full h-full flex flex-col items-center justify-center bg-slate-900">
                <img 
                  src={reviewImage} 
                  alt="Review Scan" 
                  className={`w-full h-auto object-cover ${isFiltering ? 'opacity-50 blur-sm' : ''} transition-all duration-300`} 
                />
                
                {/* Kontrol Mode Review */}
                <div className="absolute bottom-6 left-0 right-0 flex justify-center items-center gap-6 px-4 z-20">
                  <button
                    onClick={cancelReview}
                    className="flex flex-col items-center gap-1 text-white hover:text-red-400 transition-colors"
                  >
                    <div className="p-3 bg-red-500/80 rounded-full backdrop-blur-sm"><X size={24} /></div>
                    <span className="text-xs font-medium drop-shadow-md">Batal</span>
                  </button>

                  <button
                    onClick={applyDocumentFilter}
                    disabled={isFiltering}
                    className="flex flex-col items-center gap-1 text-white hover:text-blue-400 transition-colors"
                  >
                    <div className="p-4 bg-blue-600/90 rounded-full backdrop-blur-sm shadow-lg border-2 border-blue-400 hover:scale-105 active:scale-95 transition-all">
                      <Wand2 size={28} />
                    </div>
                    <span className="text-xs font-medium drop-shadow-md">Efek CamScanner</span>
                  </button>

                  <button
                    onClick={confirmImage}
                    className="flex flex-col items-center gap-1 text-white hover:text-green-400 transition-colors"
                  >
                    <div className="p-3 bg-green-500/80 rounded-full backdrop-blur-sm"><Check size={24} /></div>
                    <span className="text-xs font-medium drop-shadow-md">Simpan</span>
                  </button>
                </div>
              </div>
            ) : (
              /* JIKA SEDANG MODE KAMERA AKTIF */
              <>
                <Webcam
                  audio={false}
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  videoConstraints={{ facingMode: facingMode }}
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

          {/* Action Controls & Gallery... (Tetap sama seperti kode sebelumnya) */}
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
                  <button onClick={resetImages} disabled={isProcessing} className="flex items-center gap-2 text-red-600 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-lg text-sm font-medium">
                    <RotateCcw size={16} /> Reset
                  </button>
                  <button onClick={generatePDF} disabled={isProcessing} className="flex items-center gap-2 bg-slate-800 text-white hover:bg-slate-700 px-4 py-2 rounded-lg text-sm font-medium">
                    <Download size={16} /> Download
                  </button>
                  <button onClick={saveToDrive} disabled={isProcessing || isUploading} className="flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-medium">
                    <CloudUpload size={16} /> {isUploading ? "Uploading..." : "Save to Drive"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {images.map((img, index) => (
                  <div key={index} draggable onDragStart={() => (dragItem.current = index)} onDragEnter={() => (dragOverItem.current = index)} onDragEnd={handleSort} onDragOver={(e) => e.preventDefault()} className="relative group rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-700 aspect-[3/4] bg-slate-50 dark:bg-slate-800 flex flex-col">
                    <div className="flex-1 relative overflow-hidden">
                      <img src={img} alt={`Hal ${index + 1}`} className="w-full h-full object-cover" />
                      <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">Hal {index + 1}</div>
                      <button onClick={() => deleteImage(index)} className="absolute top-2 right-2 bg-red-500/90 text-white p-1.5 rounded-full hover:bg-red-600 md:opacity-0 md:group-hover:opacity-100">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="flex bg-slate-100 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
                      <button onClick={() => moveImage(index, "left")} disabled={index === 0} className="flex-1 py-2 flex justify-center text-slate-600 hover:bg-slate-200 disabled:opacity-30"><ChevronLeft size={18} /></button>
                      <div className="w-px bg-slate-200 dark:bg-slate-700"></div>
                      <button onClick={() => moveImage(index, "right")} disabled={index === images.length - 1} className="flex-1 py-2 flex justify-center text-slate-600 hover:bg-slate-200 disabled:opacity-30"><ChevronRight size={18} /></button>
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