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
    <div className={`min-h-screen transition-colors duration-500 font-sans selection:bg-blue-500/30 ${
      theme === 'dark' ? 'bg-[#0a0e1a] text-slate-200' : 'bg-[#f8fafc] text-slate-800'
    }`}>
      {/* Background Glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute -top-[10%] -left-[10%] w-[40%] h-[40%] blur-[120px] rounded-full transition-all duration-1000 ${
          theme === 'dark' ? 'bg-blue-600/10' : 'bg-blue-400/20'
        }`} />
        <div className={`absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] blur-[120px] rounded-full transition-all duration-1000 ${
          theme === 'dark' ? 'bg-indigo-600/10' : 'bg-indigo-400/20'
        }`} />
      </div>

      <div className="relative max-w-2xl mx-auto px-4 py-8">
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
            onClick={() => videoInputRef.current?.click()}
            disabled={isAnalyzing}
            className={`flex flex-col items-center justify-center p-6 border rounded-2xl transition-all group disabled:opacity-50 ${
              theme === 'dark'
                ? 'bg-slate-900/50 border-slate-800 hover:border-blue-500/50 hover:bg-blue-500/5'
                : 'bg-white border-slate-200 hover:border-blue-500/50 hover:bg-blue-50/50 shadow-sm'
            }`}
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors ${
              theme === 'dark' ? 'bg-slate-800 group-hover:bg-blue-500/20 group-hover:text-blue-400' : 'bg-slate-100 group-hover:bg-blue-100 group-hover:text-blue-600'
            }`}>
              <Video size={24} />
            </div>
            <span className="font-medium">Upload scanning video</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isAnalyzing}
            className={`flex flex-col items-center justify-center p-6 border rounded-2xl transition-all group disabled:opacity-50 ${
              theme === 'dark'
                ? 'bg-slate-900/50 border-slate-800 hover:border-indigo-500/50 hover:bg-indigo-500/5'
                : 'bg-white border-slate-200 hover:border-indigo-500/50 hover:bg-indigo-50/50 shadow-sm'
            }`}
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors ${
              theme === 'dark' ? 'bg-slate-800 group-hover:bg-indigo-500/20 group-hover:text-indigo-400' : 'bg-slate-100 group-hover:bg-indigo-100 group-hover:text-indigo-600'
            }`}>
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
          <div className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
            <Search size={20} />
          </div>
          <input
            type="text"
            placeholder="Search by book title or author..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full pl-12 pr-4 py-4 rounded-2xl border transition-all focus:ring-2 focus:ring-blue-500/20 outline-none ${
              theme === 'dark'
                ? 'bg-slate-900/50 border-slate-800 text-white placeholder:text-slate-600'
                : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 shadow-sm'
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
                <h3 className="text-xl font-bold text-white mb-2">AI is analyzing your content</h3>
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
                      className={`group flex items-center justify-between p-4 border rounded-2xl transition-all cursor-pointer ${
                        theme === 'dark'
                          ? 'bg-slate-900/40 border-slate-800/50 hover:bg-slate-800/40 hover:border-blue-500/30'
                          : 'bg-white border-slate-200 hover:bg-blue-50/30 hover:border-blue-300 shadow-sm'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                          theme === 'dark' ? 'bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20' : 'bg-blue-50 text-blue-600 group-hover:bg-blue-100'
                        }`}>
                          <BookIcon size={18} />
                        </div>
                        <div>
                          <h4 className={`font-bold leading-tight transition-colors ${
                            theme === 'dark' ? 'text-slate-100 group-hover:text-blue-400' : 'text-slate-900 group-hover:text-blue-600'
                          }`}>{book.title}</h4>
                          {book.author && <p className={`text-sm ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>{book.author}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Info size={16} className={`opacity-0 group-hover:opacity-100 transition-all ${theme === 'dark' ? 'text-slate-600 group-hover:text-blue-400' : 'text-slate-400 group-hover:text-blue-600'}`} />
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

          {filteredBooks.length === 0 && !isAnalyzing && capturedImages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 border ${
                theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <Library size={32} className={theme === 'dark' ? 'text-slate-700' : 'text-slate-300'} />
              </div>
              <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                {searchTerm ? "No books match your search" : "Your library is empty"}
              </h3>
              <p className={`mt-2 max-w-xs ${theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}`}>
                {searchTerm ? "Try adjusting your search terms or scan more books." : "Scan book spines or covers to start organizing your collection."}
              </p>
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
              className={`relative w-full max-w-lg border rounded-3xl overflow-hidden shadow-2xl ${
                theme === 'dark' ? 'bg-[#0d1221] border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <div className={`p-6 border-b flex items-center justify-between ${
                theme === 'dark' ? 'border-slate-800 bg-slate-900/50' : 'border-slate-100 bg-slate-50/50'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    theme === 'dark' ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'
                  }`}>
                    <BookIcon size={20} />
                  </div>
                  <div>
                    <h3 className={`font-bold leading-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{selectedBook.title}</h3>
                    <p className={`text-xs uppercase tracking-widest ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{selectedBook.category}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedBook(null)}
                  className={`p-2 rounded-full transition-colors ${
                    theme === 'dark' ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
                  }`}
                >
                  <X size={20} />
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
