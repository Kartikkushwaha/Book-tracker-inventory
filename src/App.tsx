/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useCallback } from 'react';
import { 
  Camera, 
  Upload, 
  Book as BookIcon, 
  Trash2, 
  FileText, 
  Loader2, 
  Plus, 
  X,
  ChevronRight,
  Download,
  Library,
  Info,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeImages, getBookDetails, Book } from './services/geminiService';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Markdown from 'react-markdown';

const CATEGORIES = ["Fiction", "Non-fiction", "Science", "Technology", "Self-help", "Academic", "Others"];

export default function App() {
  const [books, setBooks] = useState<Book[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [bookDetails, setBookDetails] = useState<string | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchBookDetails = async (book: Book) => {
    setSelectedBook(book);
    setBookDetails(null);
    setIsLoadingDetails(true);
    try {
      const details = await getBookDetails(book.title, book.author);
      setBookDetails(details);
    } catch (err) {
      console.error("Error fetching details:", err);
      setBookDetails("Failed to fetch details.");
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setShowCamera(true);
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Could not access camera. Please check permissions.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      setShowCamera(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setCapturedImages(prev => [...prev, dataUrl]);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const fileList = Array.from(files);
      fileList.forEach((file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setCapturedImages(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeImage = (index: number) => {
    setCapturedImages(prev => prev.filter((_, i) => i !== index));
  };

  const processImages = async () => {
    if (capturedImages.length === 0) return;
    
    setIsAnalyzing(true);
    try {
      const detectedBooks = await analyzeImages(capturedImages);
      
      // Merge and remove duplicates with more robust normalization
      setBooks(prev => {
        const combined = [...prev, ...detectedBooks];
        
        // Helper to normalize title for comparison
        const normalize = (t: string) => t.toLowerCase().replace(/[^\w\s]/gi, '').trim();

        // Group by normalized title and pick the one with the longest original title
        const uniqueMap = new Map<string, Book>();
        
        combined.forEach(book => {
          const key = normalize(book.title);
          const existing = uniqueMap.get(key);
          if (!existing || book.title.length > existing.title.length) {
            uniqueMap.set(key, book);
          }
        });

        return Array.from(uniqueMap.values());
      });
      
      setCapturedImages([]);
      setShowCamera(false);
      stopCamera();
    } catch (err) {
      console.error("Error processing images:", err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const deleteBook = (index: number) => {
    setBooks(prev => prev.filter((_, i) => i !== index));
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(22);
    doc.setTextColor(20, 30, 60);
    doc.text("Book Tracker Inventory", 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 105, 28, { align: 'center' });

    let currentY = 40;

    CATEGORIES.forEach(category => {
      const categoryBooks = books.filter(b => b.category === category);
      if (categoryBooks.length > 0) {
        doc.setFontSize(16);
        doc.setTextColor(40, 60, 120);
        doc.text(category, 14, currentY);
        currentY += 5;

        autoTable(doc, {
          startY: currentY,
          head: [['#', 'Title', 'Author']],
          body: categoryBooks.map((b, i) => [i + 1, b.title, b.author || 'Unknown']),
          theme: 'striped',
          headStyles: { fillColor: [40, 60, 120] },
          margin: { top: 10 },
        });

        currentY = (doc as any).lastAutoTable.finalY + 15;
        
        if (currentY > 250) {
          doc.addPage();
          currentY = 20;
        }
      }
    });

    doc.save("book-tracker-list.pdf");
  };

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-slate-200 font-sans selection:bg-blue-500/30">
      {/* Background Glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full" />
      </div>

      <div className="relative max-w-2xl mx-auto px-4 py-8">
        {/* Header / Logo */}
        <header className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 border border-blue-400/20">
              <span className="text-2xl font-black tracking-tighter text-white">BT</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white leading-none">Book Tracker</h1>
              <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-semibold">Futuristic Inventory</p>
            </div>
          </div>
          {books.length > 0 && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={generatePDF}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 rounded-full text-blue-400 transition-all text-sm font-medium"
            >
              <Download size={16} />
              Export PDF
            </motion.button>
          )}
        </header>

        {/* Main Actions */}
        <div className="grid grid-cols-2 gap-4 mb-12">
          <button
            onClick={startCamera}
            className="flex flex-col items-center justify-center p-6 bg-slate-900/50 border border-slate-800 rounded-2xl hover:border-blue-500/50 hover:bg-blue-500/5 transition-all group"
          >
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mb-3 group-hover:bg-blue-500/20 group-hover:text-blue-400 transition-colors">
              <Camera size={24} />
            </div>
            <span className="font-medium">Scan Books</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center p-6 bg-slate-900/50 border border-slate-800 rounded-2xl hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all group"
          >
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mb-3 group-hover:bg-indigo-500/20 group-hover:text-indigo-400 transition-colors">
              <Upload size={24} />
            </div>
            <span className="font-medium">Upload Photos</span>
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            multiple 
            accept="image/*" 
            className="hidden" 
          />
        </div>

        {/* Camera Overlay */}
        <AnimatePresence>
          {showCamera && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black flex flex-col"
            >
              <div className="relative flex-1 bg-black overflow-hidden">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none">
                  <div className="w-full h-full border border-blue-500/30 rounded-lg" />
                </div>
              </div>
              
              <div className="p-8 bg-[#0a0e1a] flex items-center justify-between">
                <button 
                  onClick={() => { stopCamera(); setShowCamera(false); }}
                  className="p-4 rounded-full bg-slate-800 text-slate-400"
                >
                  <X size={24} />
                </button>
                <button 
                  onClick={capturePhoto}
                  className="w-20 h-20 rounded-full border-4 border-white/20 p-1"
                >
                  <div className="w-full h-full rounded-full bg-white shadow-lg shadow-white/20 active:scale-95 transition-transform" />
                </button>
                <div className="w-14 h-14 rounded-lg bg-slate-800 overflow-hidden border border-slate-700">
                  {capturedImages.length > 0 && (
                    <img src={capturedImages[capturedImages.length - 1]} className="w-full h-full object-cover" />
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Preview & Analysis */}
        <AnimatePresence>
          {capturedImages.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 mb-12 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Library size={20} className="text-blue-400" />
                  Captured Images ({capturedImages.length})
                </h3>
                <button 
                  onClick={() => setCapturedImages([])}
                  className="text-slate-500 hover:text-red-400 transition-colors"
                >
                  Clear All
                </button>
              </div>
              
              <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
                {capturedImages.map((img, i) => (
                  <div key={i} className="relative flex-shrink-0 w-24 h-32 rounded-xl overflow-hidden border border-slate-700 group">
                    <img src={img} className="w-full h-full object-cover" />
                    <button 
                      onClick={() => removeImage(i)}
                      className="absolute top-1 right-1 p-1 bg-black/60 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={processImages}
                disabled={isAnalyzing}
                className="w-full mt-4 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl font-bold text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Analyzing with AI...
                  </>
                ) : (
                  <>
                    <ChevronRight size={20} />
                    Identify Books
                  </>
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Book List */}
        <div className="space-y-12">
          {CATEGORIES.map(category => {
            const categoryBooks = books.filter(b => b.category === category);
            if (categoryBooks.length === 0) return null;

            return (
              <section key={category} className="space-y-4">
                <div className="flex items-center gap-4">
                  <h2 className="text-sm font-black uppercase tracking-[0.2em] text-blue-400/80">{category}</h2>
                  <div className="flex-1 h-px bg-slate-800" />
                  <span className="text-xs font-mono text-slate-500">{categoryBooks.length}</span>
                </div>
                
                <div className="grid gap-3">
                  {categoryBooks.map((book, i) => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      key={book.title}
                      onClick={() => fetchBookDetails(book)}
                      className="group flex items-center justify-between p-4 bg-slate-900/40 border border-slate-800/50 rounded-2xl hover:bg-slate-800/40 hover:border-blue-500/30 transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:bg-blue-500/20 transition-colors">
                          <BookIcon size={18} />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-100 leading-tight group-hover:text-blue-400 transition-colors">{book.title}</h4>
                          {book.author && <p className="text-sm text-slate-500">{book.author}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Info size={16} className="text-slate-600 group-hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all" />
                        <button 
                          onClick={(e) => { e.stopPropagation(); deleteBook(books.indexOf(book)); }}
                          className="p-2 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </section>
            );
          })}

          {books.length === 0 && !isAnalyzing && capturedImages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 rounded-full bg-slate-900 flex items-center justify-center mb-6 border border-slate-800">
                <Library size={32} className="text-slate-700" />
              </div>
              <h3 className="text-xl font-bold text-slate-400">Your library is empty</h3>
              <p className="text-slate-600 mt-2 max-w-xs">Scan book spines or covers to start organizing your collection.</p>
            </div>
          )}
        </div>
      </div>

      {/* Book Details Modal */}
      <AnimatePresence>
        {selectedBook && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-[#0d1221] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                    <BookIcon size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-white leading-tight">{selectedBook.title}</h3>
                    <p className="text-xs text-slate-400 uppercase tracking-widest">{selectedBook.category}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedBook(null)}
                  className="p-2 rounded-full hover:bg-slate-800 text-slate-400 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
                {isLoadingDetails ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-4">
                    <Loader2 className="animate-spin text-blue-500" size={32} />
                    <p className="text-slate-400 font-medium animate-pulse">Searching Google for insights...</p>
                  </div>
                ) : (
                  <div className="prose prose-invert prose-blue max-w-none">
                    <div className="markdown-body text-slate-300 leading-relaxed">
                      <Markdown>{bookDetails}</Markdown>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-slate-800 bg-slate-900/30 flex justify-end">
                <button 
                  onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(selectedBook.title + (selectedBook.author ? ' ' + selectedBook.author : ''))}`, '_blank')}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold transition-all shadow-lg shadow-blue-500/20"
                >
                  <ExternalLink size={18} />
                  Search on Google
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer Info */}
      <footer className="max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-xs text-slate-600 font-mono uppercase tracking-widest">
          Powered by Gemini AI & BT Engine
        </p>
      </footer>
    </div>
  );
}
