"use client";

import React, { useRef, useState, useEffect } from "react";
import Webcam from "react-webcam";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { Camera, Download, Trash2, CloudUpload, RotateCcw, FileText, Grip, Sun, Moon } from "lucide-react";
import { blob } from "stream/consumers";

export default function Scanner() {
  const webcamRef = useRef<Webcam>(null);
  const [images, setImages] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // State untuk Dark Mode
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Drag and Drop Refs
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const capture = () => {
    const screenshot = webcamRef.current?.getScreenshot();
    if (screenshot) setImages((prev) => [...prev, screenshot]);
  };

  const deleteImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const resetImages = () => {
    if (confirm("Yakin ingin menghapus semua halaman?")) {
      setImages([]);
    }
  };

  // Drag and Drop Logic
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

      page.drawText("DOCFLOW WATERMARK", {
        x: 50,
        y: jpgImage.height / 2,
        size: 30,
        font,
        color: rgb(0.75, 0.75, 0.75),
        opacity: 0.3,
      });

      if (i === images.length - 1) {
        page.drawText("COMPANY STAMP", {
          x: jpgImage.width - 220,
          y: 50,
          size: 24,
          font,
          color: rgb(1, 0, 0),
        });
      }
    }

    return await pdfDoc.save();
  };

  const generatePDF = async () => {
    try {
      setIsProcessing(true);
      const pdfBytes = await buildPDF();
      const blob = new Blob([Uint8Array.from(pdfBytes)], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      const now = new Date();
      const fileName = `DOCFLOW_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}.pdf`;

      link.download = fileName;
      link.click();
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Gagal membuat PDF.");
    } finally {
      setIsProcessing(false);
    }
  };

  const sendPDFToDrive = async () => {
    try {
      setIsProcessing(true);
      const pdfBytes = await buildPDF();

      const now = new Date();
      const fileName = `DOCFLOW_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}.pdf`;

      const res = await fetch("/api/drive-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName,
          pdf: Array.from(pdfBytes),
        }),
      });

      const data = await res.json();

      if (data.fileId || data.fileName) {
        alert(`Uploaded: ${data.fileId || data.fileName}`);
      } else {
        alert(data.error || "Upload gagal");
      }
    } catch (error) {
      console.error("Error uploading to Drive:", error);
      alert("Terjadi kesalahan saat upload.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    // Wrapper utama yang mengontrol class "dark"
    <div className={`${isDarkMode ? "dark" : ""}`}>
      {/* Background UI Utama */}
      <div className="min-h-screen transition-colors duration-300 bg-white dark:bg-slate-950">
        <div className="max-w-4xl mx-auto p-4 md:p-8 flex flex-col gap-8 font-sans text-slate-800 dark:text-slate-100 transition-colors duration-300">
          
          {/* Header & Theme Toggle */}
          <div className="relative text-center space-y-2">
            <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
              <FileText className="text-blue-600 dark:text-blue-400" /> DocFlow Scanner
            </h1>
            <p className="text-slate-500 dark:text-slate-400">Scan Doc and Auto Upload to Your Drive.</p>
            
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="absolute right-0 top-0 p-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
              title={isDarkMode ? "Beralih ke Mode Terang" : "Beralih ke Mode Gelap"}
            >
              {isDarkMode ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} className="text-slate-600" />}
            </button>
          </div>

          {/* Camera Section */}
          <div className="relative mx-auto w-full max-w-2xl rounded-2xl overflow-hidden shadow-xl border-4 border-slate-100 dark:border-slate-800 bg-black group transition-colors duration-300">
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              className="w-full h-auto object-cover opacity-95 transition-opacity duration-300 group-hover:opacity-100"
            />
            
            {/* Shutter Button */}
            <div className="absolute bottom-6 left-0 right-0 flex justify-center">
              <button
                onClick={capture}
                className="flex items-center justify-center w-16 h-16 bg-white dark:bg-slate-200 rounded-full shadow-lg border-4 border-slate-200 dark:border-slate-400 hover:scale-105 active:scale-95 transition-all"
                title="Ambil Gambar"
              >
                <Camera className="text-slate-800" size={28} />
              </button>
            </div>
          </div>

          {/* Action Controls & Gallery */}
          {images.length > 0 && (
            <div className="space-y-6">
              {/* Toolbar */}
              <div className="flex flex-col md:flex-row items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 gap-4 transition-colors duration-300">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-medium">
                  <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 py-1 px-3 rounded-full text-sm transition-colors">
                    {images.length} Halaman
                  </span>
                  siap diproses
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={resetImages}
                    disabled={isProcessing}
                    className="flex items-center gap-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 px-4 py-2 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    <RotateCcw size={16} /> Reset
                  </button>

                  <button
                    onClick={generatePDF}
                    disabled={isProcessing}
                    className="flex items-center gap-2 bg-slate-800 dark:bg-slate-700 text-white hover:bg-slate-700 dark:hover:bg-slate-600 px-4 py-2 rounded-lg transition-colors text-sm font-medium shadow-sm disabled:opacity-50"
                  >
                    <Download size={16} /> {isProcessing ? "Memproses..." : "Download PDF"}
                  </button>

                  <button
                    onClick={sendPDFToDrive}
                    disabled={isProcessing}
                    className="flex items-center gap-2 bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600 px-4 py-2 rounded-lg transition-colors text-sm font-medium shadow-sm disabled:opacity-50"
                  >
                    <CloudUpload size={16} /> {isProcessing ? "Uploading..." : "Save to Drive"}
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-400 dark:text-slate-500 text-center -mb-2">
                💡 Tips: Seret dan lepas (drag & drop) gambar untuk mengubah urutan halaman.
              </p>

              {/* Image Grid with Drag and Drop */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {images.map((img, index) => (
                  <div
                    key={index}
                    draggable
                    onDragStart={() => (dragItem.current = index)}
                    onDragEnter={() => (dragOverItem.current = index)}
                    onDragEnd={handleSort}
                    onDragOver={(e) => e.preventDefault()}
                    className="relative group rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-700 aspect-[3/4] bg-slate-50 dark:bg-slate-800 cursor-grab active:cursor-grabbing hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
                  >
                    <img
                      src={img}
                      alt={`Halaman ${index + 1}`}
                      className="w-full h-full object-cover pointer-events-none opacity-90 dark:opacity-80 group-hover:opacity-100 transition-opacity"
                    />
                    
                    {/* Drag Indicator (Icon) */}
                    <div className="absolute top-2 left-2 bg-black/40 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                      <Grip size={14} />
                    </div>
                    
                    {/* Page Number Badge */}
                    <div className="absolute bottom-2 left-2 bg-black/60 dark:bg-black/80 text-white text-xs px-2 py-1 rounded backdrop-blur-sm font-medium">
                      Hal {index + 1}
                    </div>

                    {/* Delete Button (Appears on Hover) */}
                    <button
                      onClick={() => deleteImage(index)}
                      className="absolute top-2 right-2 bg-red-500/90 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-sm"
                      title="Hapus gambar ini"
                    >
                      <Trash2 size={14} />
                    </button>
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