/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useCallback } from 'react';
import { 
  Video, 
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
  ExternalLink,
  Search,
  Sun,
  Moon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeImages, analyzeVideo, getBookDetails, Book } from './services/geminiService';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Markdown from 'react-markdown';

const CATEGORIES = ["Fiction", "Non-fiction", "Science", "Technology", "Self-help", "Academic", "Others"];

export default function App() {
  const [books, setBooks] = useState<Book[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [bookDetails, setBookDetails] = useState<string | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [showVideoWarning, setShowVideoWarning] = useState(false);
  const [showAccuracyTips, setShowAccuracyTips] = useState(false);
  const [dontShowVideoWarning, setDontShowVideoWarning] = useState(false);
  const [dontShowAccuracyTips, setDontShowAccuracyTips] = useState(false);
  const [activeTrigger, setActiveTrigger] = useState<'video' | 'photo' | null>(null);

  const handleVideoClick = () => {
    setActiveTrigger('video');
    if (!dontShowVideoWarning) {
      setShowVideoWarning(true);
    } else if (!dontShowAccuracyTips) {
      setShowAccuracyTips(true);
    } else {
      videoInputRef.current?.click();
    }
  };

  const handlePhotoClick = () => {
    setActiveTrigger('photo');
    if (!dontShowAccuracyTips) {
      setShowAccuracyTips(true);
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleVideoWarningClose = (dontShowAgain: boolean) => {
    if (dontShowAgain) setDontShowVideoWarning(true);
    setShowVideoWarning(false);
    if (!dontShowAccuracyTips) {
      setShowAccuracyTips(true);
    } else {
      videoInputRef.current?.click();
    }
  };

  const handleAccuracyTipsClose = (dontShowAgain: boolean) => {
    if (dontShowAgain) setDontShowAccuracyTips(true);
    setShowAccuracyTips(false);
    if (activeTrigger === 'video') {
      videoInputRef.current?.click();
    } else {
      fileInputRef.current?.click();
    }
  };
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const filteredBooks = books.filter(book => 
    book.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (book.author && book.author.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsAnalyzing(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Video = reader.result as string;
        try {
          const detectedBooks = await analyzeVideo(base64Video, file.type);
          updateBookList(detectedBooks);
        } catch (err) {
          console.error("Error analyzing video:", err);
          alert("Error analyzing video. Please try a shorter or smaller video file.");
        } finally {
          setIsAnalyzing(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const updateBookList = (newBooks: Book[]) => {
    const cleanedNewBooks = newBooks.map(book => {
      let cleanedAuthor = book.author;
      if (cleanedAuthor) {
        // Remove commas
        cleanedAuthor = cleanedAuthor.replace(/,/g, '');
        // Handle "Unknown"
        if (cleanedAuthor.toLowerCase() === 'unknown' || cleanedAuthor.trim() === '') {
          cleanedAuthor = undefined;
        }
      }
      return { ...book, author: cleanedAuthor };
    });

    const normalize = (t: string) => t.toLowerCase().replace(/[^\w\s]/gi, '').trim();
    const uniqueMap = new Map<string, Book>();
    cleanedNewBooks.forEach(book => {
      const key = normalize(book.title);
      const existing = uniqueMap.get(key);
      if (!existing || book.title.length > existing.title.length) {
        uniqueMap.set(key, book);
      }
    });
    setBooks(Array.from(uniqueMap.values()));
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
      updateBookList(detectedBooks);
      setCapturedImages([]);
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
          body: categoryBooks.map((b, i) => [i + 1, b.title, b.author || '']),
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
    <div className={`min-h-screen transition-colors duration-700 font-sans selection:bg-blue-500/30 relative overflow-hidden ${
      theme === 'dark' ? 'bg-[#020617] text-slate-200' : 'bg-[#F8F9FA] text-slate-800'
    }`}>
      {/* Premium Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        {/* Animated Glow Blobs */}
        <motion.div 
          animate={{ 
            x: [0, 50, 0], 
            y: [0, 30, 0],
            scale: [1, 1.1, 1]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className={`absolute -top-[10%] -left-[10%] w-[70%] h-[70%] blur-[160px] rounded-full transition-all duration-1000 ${
            theme === 'dark' ? 'bg-blue-600/15' : 'bg-blue-500/10'
          }`} 
        />
        <motion.div 
          animate={{ 
            x: [0, -40, 0], 
            y: [0, -50, 0],
            scale: [1, 1.2, 1]
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className={`absolute -bottom-[10%] -right-[10%] w-[70%] h-[70%] blur-[160px] rounded-full transition-all duration-1000 ${
            theme === 'dark' ? 'bg-indigo-600/15' : 'bg-indigo-500/10'
          }`} 
        />
        
        {/* Pattern Overlay */}
        <div className={`absolute inset-0 opacity-[0.03] ${theme === 'dark' ? 'invert' : ''}`} 
             style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        
        {/* Noise Texture */}
        <div className="absolute inset-0 opacity-[0.015] mix-blend-overlay pointer-events-none"
             style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-8">
        {/* Header / Logo */}
        <header className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 border border-blue-400/20">
              <span className="text-2xl font-black tracking-tighter text-white">BT</span>
            </div>
            <div>
              <h1 className={`text-2xl font-bold tracking-tight leading-none ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Book Tracker</h1>
              <p className={`text-xs mt-1 uppercase tracking-widest font-semibold ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Futuristic Inventory</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-full transition-all ${
                theme === 'dark' 
                  ? 'bg-slate-800 text-yellow-400 hover:bg-slate-700' 
                  : 'bg-white text-slate-600 hover:bg-slate-100 shadow-sm border border-slate-200'
              }`}
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            {books.length > 0 && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={generatePDF}
                className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all text-sm font-medium ${
                  theme === 'dark'
                    ? 'bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 text-blue-400'
                    : 'bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-600'
                }`}
              >
                <Download size={16} />
                Export PDF
              </motion.button>
            )}
          </div>
        </header>

        {/* Main Actions */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <button
            onClick={handleVideoClick}
            disabled={isAnalyzing}
            className={`flex flex-col items-center justify-center p-6 border transition-all duration-500 group disabled:opacity-50 relative overflow-hidden rounded-[2rem] ${
              theme === 'dark'
                ? 'bg-slate-900/40 border-white/20 hover:bg-white/10'
                : 'bg-white/80 backdrop-blur-md border-slate-200/60 hover:bg-white shadow-[0_20px_50px_rgba(0,0,0,0.05)] hover:shadow-[0_30px_60px_rgba(0,0,0,0.08)] hover:-translate-y-1'
            }`}
          >
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-all duration-500 ${
              theme === 'dark' 
                ? 'bg-slate-800 group-hover:bg-white group-hover:text-black group-hover:scale-110' 
                : 'bg-slate-50 group-hover:bg-blue-600 group-hover:text-white group-hover:scale-110 shadow-inner'
            }`}>
              <Video size={28} />
            </div>
            <span className="font-bold tracking-tight text-sm uppercase">Scanning Video</span>
            <div className={`absolute bottom-0 left-0 h-1 bg-blue-500 transition-all duration-500 w-0 group-hover:w-full`} />
          </button>
          <button
            onClick={handlePhotoClick}
            disabled={isAnalyzing}
            className={`flex flex-col items-center justify-center p-6 border transition-all duration-500 group disabled:opacity-50 relative overflow-hidden rounded-[2rem] ${
              theme === 'dark'
                ? 'bg-slate-900/40 border-white/20 hover:bg-white/10'
                : 'bg-white/80 backdrop-blur-md border-slate-200/60 hover:bg-white shadow-[0_20px_50px_rgba(0,0,0,0.05)] hover:shadow-[0_30px_60px_rgba(0,0,0,0.08)] hover:-translate-y-1'
            }`}
          >
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-all duration-500 ${
              theme === 'dark' 
                ? 'bg-slate-800 group-hover:bg-white group-hover:text-black group-hover:scale-110' 
                : 'bg-slate-50 group-hover:bg-blue-600 group-hover:text-white group-hover:scale-110 shadow-inner'
            }`}>
              <Upload size={28} />
            </div>
            <span className="font-bold tracking-tight text-sm uppercase">Upload Photos</span>
            <div className={`absolute bottom-0 left-0 h-1 bg-blue-500 transition-all duration-500 w-0 group-hover:w-full`} />
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            multiple 
            accept="image/*" 
            className="hidden" 
          />
          <input 
            type="file" 
            ref={videoInputRef} 
            onChange={handleVideoUpload} 
            accept="video/*" 
            className="hidden" 
          />
        </div>

        {/* Search Bar */}
        <div className="relative mb-12">
          <div className={`absolute left-6 top-1/2 -translate-y-1/2 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
            <Search size={22} />
          </div>
          <input
            type="text"
            placeholder="Search by book title or author..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full pl-16 pr-8 py-6 rounded-[2.5rem] border transition-all focus:ring-4 focus:ring-blue-500/10 outline-none ${
              theme === 'dark'
                ? 'bg-slate-900/50 border-white/20 text-white placeholder:text-slate-600'
                : 'bg-white/80 backdrop-blur-md border-slate-200/60 text-slate-900 placeholder:text-slate-400 shadow-[0_15px_40px_rgba(0,0,0,0.03)] focus:bg-white'
            }`}
          />
        </div>

        {/* Analysis Loading State */}
        <AnimatePresence>
          {isAnalyzing && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-blue-600/10 border border-blue-500/30 rounded-3xl p-8 mb-12 flex flex-col items-center justify-center gap-4 text-center"
            >
              <div className="relative">
                <Loader2 className="animate-spin text-blue-500" size={48} />
                <div className="absolute inset-0 blur-xl bg-blue-500/20 animate-pulse" />
              </div>
              <div>
                <h3 className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-blue-900'}`}>AI is analyzing your content</h3>
                <p className="text-slate-400 text-sm max-w-xs mx-auto">
                  We're extracting book titles, authors, and categories. This may take a moment depending on the file size.
                </p>
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
            const categoryBooks = filteredBooks.filter(b => b.category === category);
            if (categoryBooks.length === 0) return null;

            return (
              <section key={category} className="space-y-4">
                <div className="flex items-center gap-4">
                  <h2 className={`text-sm font-black uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-blue-400/80' : 'text-blue-600'}`}>{category}</h2>
                  <div className={`flex-1 h-px ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'}`} />
                  <span className={`text-xs font-mono ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>{categoryBooks.length}</span>
                </div>
                
                <div className="grid gap-3">
                  {categoryBooks.map((book) => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      key={book.title}
                      onClick={() => fetchBookDetails(book)}
                      className={`group flex items-center justify-between p-5 border transition-all cursor-pointer rounded-2xl ${
                        theme === 'dark'
                          ? 'bg-slate-900/40 border-slate-800/50 hover:bg-slate-800/40 hover:border-blue-500/30'
                          : 'bg-white/60 backdrop-blur-sm border-slate-100/80 hover:bg-white hover:border-blue-200 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:shadow-[0_10px_30px_rgba(0,0,0,0.05)] hover:-translate-y-0.5'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
                          theme === 'dark' ? 'bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20' : 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white group-hover:shadow-lg group-hover:shadow-blue-200'
                        }`}>
                          <BookIcon size={20} />
                        </div>
                        <div>
                          <h4 className={`font-bold leading-tight transition-colors text-base ${
                            theme === 'dark' ? 'text-slate-100 group-hover:text-blue-400' : 'text-slate-900 group-hover:text-blue-600'
                          }`}>{book.title}</h4>
                          {book.author && <p className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>{book.author}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Info size={18} className={`opacity-0 group-hover:opacity-100 transition-all ${theme === 'dark' ? 'text-slate-600 group-hover:text-blue-400' : 'text-slate-300 group-hover:text-blue-600'}`} />
                        <button 
                          onClick={(e) => { e.stopPropagation(); deleteBook(books.indexOf(book)); }}
                          className={`p-2 rounded-lg transition-all opacity-0 group-hover:opacity-100 ${
                            theme === 'dark' ? 'text-slate-600 hover:text-red-400 hover:bg-red-400/10' : 'text-slate-300 hover:text-red-500 hover:bg-red-50'
                          }`}
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </section>
            );
          })}

          {filteredBooks.length === 0 && !isAnalyzing && capturedImages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className={`w-24 h-24 rounded-[2rem] flex items-center justify-center mb-8 border transition-all duration-500 ${
                theme === 'dark' ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100 shadow-xl shadow-slate-200/50'
              }`}>
                <Library size={40} className={theme === 'dark' ? 'text-slate-400' : 'text-blue-600'} />
              </div>
              <h3 className={`text-2xl font-bold tracking-tight ${theme === 'dark' ? 'text-slate-400' : 'text-slate-900'}`}>
                {searchTerm ? "No books match your search" : "Your library is empty"}
              </h3>
              <p className={`mt-3 max-w-xs leading-relaxed ${theme === 'dark' ? 'text-slate-600' : 'text-slate-500'}`}>
                {searchTerm ? "Try adjusting your search terms or scan more books." : "Scan book spines or covers to start organizing your collection."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Warning Popups */}
      <AnimatePresence>
        {showVideoWarning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className={`relative w-full max-w-md border rounded-[2.5rem] overflow-hidden shadow-2xl p-8 flex flex-col items-center text-center ${
                  theme === 'dark' ? 'bg-[#0d1221] border-white/20' : 'bg-white border-slate-100'
                }`}
              >
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 border relative ${
                  theme === 'dark' ? 'bg-blue-500/20 border-white/30 text-blue-400' : 'bg-blue-50 border-blue-100 text-blue-600'
                }`}>
                  <Library size={32} />
                  <div className={`absolute -top-2 -right-2 px-2 py-1 rounded-lg text-[10px] font-black border ${
                    theme === 'dark' ? 'bg-blue-600 border-white/30 text-white' : 'bg-blue-600 border-blue-400 text-white'
                  }`}>BT</div>
                </div>
                
                <h3 className={`text-xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  Video Accuracy Warning
                </h3>
                
                <p className={`mb-8 leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                  Scanning video mode might decrease the accuracy, it is preferred to use upload photos.
                </p>

                <div className="flex flex-col gap-3 w-full">
                  <button
                    onClick={() => handleVideoWarningClose(false)}
                    className={`w-full py-4 rounded-2xl font-bold transition-all ${
                      theme === 'dark' 
                        ? 'bg-blue-600 text-white hover:bg-blue-500' 
                        : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200'
                    }`}
                  >
                    I got it
                  </button>
                  <button
                    onClick={() => handleVideoWarningClose(true)}
                    className={`w-full py-4 rounded-2xl font-bold transition-all border ${
                      theme === 'dark' 
                        ? 'border-slate-800 text-slate-400 hover:bg-slate-800' 
                        : 'border-slate-200 text-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    Don't show it again
                  </button>
                </div>
              </motion.div>
          </motion.div>
        )}

        {showAccuracyTips && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className={`relative w-full max-w-md border rounded-[2.5rem] overflow-hidden shadow-2xl p-8 flex flex-col items-center text-center ${
                  theme === 'dark' ? 'bg-[#0d1221] border-white/20' : 'bg-white border-slate-100'
                }`}
              >
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 border relative ${
                  theme === 'dark' ? 'bg-blue-500/20 border-white/30 text-blue-400' : 'bg-blue-50 border-blue-100 text-blue-600'
                }`}>
                  <Info size={32} />
                  <div className={`absolute -top-2 -right-2 px-2 py-1 rounded-lg text-[10px] font-black border ${
                    theme === 'dark' ? 'bg-blue-600 border-white/30 text-white' : 'bg-blue-600 border-blue-400 text-white'
                  }`}>BT</div>
                </div>
                
                <h3 className={`text-xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  Better Accuracy Tips
                </h3>
                
                <p className={`mb-8 leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                  For better accuracy click photos/scan in well lighted area, and while recording it is preferred to record slowly for better accuracy.
                </p>

                <div className="flex flex-col gap-3 w-full">
                  <button
                    onClick={() => handleAccuracyTipsClose(false)}
                    className={`w-full py-4 rounded-2xl font-bold transition-all ${
                      theme === 'dark' 
                        ? 'bg-blue-600 text-white hover:bg-blue-500' 
                        : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200'
                    }`}
                  >
                    I got it
                  </button>
                  <button
                    onClick={() => handleAccuracyTipsClose(true)}
                    className={`w-full py-4 rounded-2xl font-bold transition-all border ${
                      theme === 'dark' 
                        ? 'border-slate-800 text-slate-400 hover:bg-slate-800' 
                        : 'border-slate-200 text-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    Don't show it again
                  </button>
                </div>
              </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
              className={`relative w-full max-w-lg border rounded-[2.5rem] overflow-hidden shadow-2xl ${
                theme === 'dark' ? 'bg-[#0d1221] border-slate-800' : 'bg-white/95 backdrop-blur-xl border-slate-100'
              }`}
            >
              <div className={`p-6 border-b flex items-center justify-between ${
                theme === 'dark' ? 'border-slate-800 bg-slate-900/50' : 'border-slate-50 bg-slate-50/80'
              }`}>
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${
                    theme === 'dark' ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600'
                  }`}>
                    <BookIcon size={24} />
                  </div>
                  <div>
                    <h3 className={`text-lg font-bold leading-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{selectedBook.title}</h3>
                    <p className={`text-xs uppercase tracking-[0.2em] font-bold ${theme === 'dark' ? 'text-slate-400' : 'text-blue-600/60'}`}>{selectedBook.category}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedBook(null)}
                  className={`p-2.5 rounded-full transition-all ${
                    theme === 'dark' ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <X size={22} />
                </button>
              </div>

              <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
                {isLoadingDetails ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-4">
                    <Loader2 className="animate-spin text-blue-500" size={32} />
                    <p className={`font-medium animate-pulse ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Searching Google for insights...</p>
                  </div>
                ) : (
                  <div className={`prose max-w-none ${theme === 'dark' ? 'prose-invert prose-blue' : 'prose-slate'}`}>
                    <div className={`markdown-body leading-relaxed ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                      <Markdown>{bookDetails}</Markdown>
                    </div>
                  </div>
                )}
              </div>

              <div className={`p-6 border-t bg-slate-900/30 flex justify-end ${
                theme === 'dark' ? 'border-slate-800 bg-slate-900/30' : 'border-slate-100 bg-slate-50/30'
              }`}>
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
      <footer className="max-w-2xl mx-auto px-4 py-12 text-center space-y-4">
        <p className={`text-xs font-mono uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}`}>
          Powered by Gemini AI & BT Engine
        </p>
        <div className="flex flex-col items-center gap-2">
          <p className={`text-sm font-medium tracking-tight ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
            Developed by <span className="text-blue-500 font-bold">Kartik Kumar</span>
          </p>
          <div className={`h-px w-12 ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'}`} />
        </div>
      </footer>
    </div>
  );
}
