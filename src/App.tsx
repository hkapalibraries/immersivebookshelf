import { useState, useEffect } from "react";
import { BookData } from "./types";
import { fetchBooks } from "./lib/data";
import { LibraryScene } from "./components/LibraryScene";
import { motion, AnimatePresence } from "motion/react";
import { Loader2, X, ExternalLink, BookOpen, ZoomIn, ZoomOut, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Play, Pause, Search, ChevronDown, Mouse, ArrowUpDown } from "lucide-react";

export default function App() {
  const [books, setBooks] = useState<BookData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBook, setSelectedBook] = useState<BookData | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    fetchBooks()
      .then((data) => {
        const validBooks = data.filter((b) => b.Title && b.Title.trim() !== "");
        setBooks(validBooks);
        // Heuristic: if we only have the 4 fallback entries, we are not on the user's real sheet.
        const isFallback = validBooks.length <= 4 && validBooks.some(b => b.Title === "阿茜的救國夢");
        setUsingFallback(isFallback);
        if (isFallback) {
          console.info("[App] Currently using built-in FALLBACK_BOOKS (Google Sheets CSV returned HTML or too few rows). Covers for the demo titles should still load in 3D. Provide your published ?output=csv link to switch to your full data.");
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to load library data");
        setLoading(false);
      });
  }, []);

  const handleControl = (action: string) => {
    window.dispatchEvent(new CustomEvent('camera-control', { detail: action }));
  };

  const handleInteract = () => {
    setAutoRotate(false);
  };

  // Wrapper so we can log exactly what data the clicked/selected book carries (helps debug "success in 3D but panel shows no cover")
  const handleSelectBook = (book: BookData) => {
    console.log(`[App] Selected book: "${book.Title}"`, {
      hasCover: !!book.cover,
      coverValue: book.cover || "(none)",
      publisher: book.Publisher || book["Publication Year"] || "??",
      materialType: book["Material Type"]
    });
    setSelectedBook(book);
    handleInteract();
  };

  return (
    <div className="w-full h-screen bg-[#f4efe6] text-slate-900 overflow-hidden relative font-sans">
      {/* Background with fade-out effect */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center opacity-60 pointer-events-none"
        style={{ 
          backgroundImage: `url('https://images.unsplash.com/photo-1593173945705-d6451ed5909a')`,
          maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 90%)',
          WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 90%)'
        }}
      />
      
      <header className="absolute top-0 left-0 w-full p-6 z-10 pointer-events-none flex flex-col md:flex-row justify-between items-start gap-4">
        <div className="pointer-events-auto flex-shrink-0">
          <h1 className="text-2xl md:text-3xl font-medium tracking-tight text-slate-900 flex items-start gap-3">
            <BookOpen className="w-8 h-8 text-amber-700 mt-0.5" />
            <div className="flex flex-col leading-tight gap-0.5">
              <span>毛俊輝相關館藏</span>
              <span className="text-xl md:text-2xl font-normal tracking-normal text-slate-700">Fredric Mao Related Collection</span>
            </div>
          </h1>
          <p className="text-slate-600 mt-2 max-w-sm text-sm font-medium">
            Explore the curated collection records. Drag to rotate, scroll to zoom.
          </p>
          {usingFallback && (
            <div className="mt-2 text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-800 inline-block">
              使用內建測試資料（Google 試算表目前回傳 HTML）。封面載入邏輯可直接測試；想用你完整的書單請把「發布為 CSV」的網址貼給我。
            </div>
          )}
        </div>

        {/* Search & Pull-down feature */}
        {!loading && !error && (
          <div className="pointer-events-auto bg-white/90 backdrop-blur-md rounded-xl p-2 shadow-sm border border-amber-900/10 flex items-center gap-2 w-full max-w-sm">
            <Search className="w-5 h-5 text-slate-400 ml-2 shrink-0" />
            <div className="relative w-full flex items-center">
              <input 
                type="text"
                list="book-list"
                autoComplete="off"
                placeholder="Search or select a book..."
                className="book-search-input w-full bg-transparent border-none text-sm text-slate-700 focus:ring-0 outline-none placeholder:text-slate-400 pr-10"
                onChange={(e) => {
                  const book = books.find(b => b.Title === e.target.value);
                  if (book) {
                    handleSelectBook(book);
                  }
                }}
                onFocus={(e) => e.target.value = ''}
              />
              {/* Custom chevron only — native datalist arrow is suppressed via CSS + positioning */}
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-1.5 pointer-events-none z-10" />
              <datalist id="book-list">
                {books.map((b, i) => (
                  <option key={`opt-${i}`} value={b.Title} />
                ))}
              </datalist>
            </div>
          </div>
        )}
      </header>

      {/* Main 3D Canvas */}
      {!loading && !error && (
        <div className="absolute inset-0 z-0">
          <LibraryScene 
            books={books} 
            onSelectBook={handleSelectBook} 
            selectedBook={selectedBook} 
            autoRotate={autoRotate} 
            onInteract={handleInteract}
          />
        </div>
      )}

      {/* Loading Overlay */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#f4efe6]"
          >
            <Loader2 className="w-12 h-12 text-amber-600 animate-spin mb-4" />
            <p className="text-slate-500 font-medium tracking-widest uppercase text-sm">Initializing Space</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#f4efe6]">
          <p className="text-red-500 font-mono">{error}</p>
        </div>
      )}

      {/* Selected Book Overlay */}
      <AnimatePresence>
        {selectedBook && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute bottom-16 md:bottom-8 left-1/2 -translate-x-1/2 z-20 w-[90%] max-w-3xl pointer-events-auto"
          >
            <div className="flex flex-col md:flex-row gap-6 items-center md:items-end w-full">
              {/* Enlarge Cover & Pop Out of Info Box */}
              <div className="w-[180px] md:w-[240px] flex-shrink-0 animate-in fade-in slide-in-from-bottom flex flex-col shadow-2xl rounded-lg overflow-hidden border border-slate-200 bg-white ml-0 md:ml-4">
                {selectedBook.cover ? (
                  <img src={selectedBook.cover} alt="Cover" className="w-full h-auto object-cover" />
                ) : (
                  <div className="w-full aspect-[2/3] flex items-center justify-center bg-slate-100/90 text-slate-400 text-sm italic">
                    no cover
                  </div>
                )}
              </div>

              {/* Info Box */}
              <div className="bg-white/95 backdrop-blur-xl border border-amber-900/10 rounded-2xl p-6 md:p-8 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] flex-1 relative w-full mb-0 md:mb-4">
                <button
                  onClick={() => setSelectedBook(null)}
                  className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-900 transition-colors rounded-full hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="pr-4 md:pr-8">
                  <span className="inline-block px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-semibold uppercase tracking-wider mb-3">
                    {selectedBook["Material Type"] || "Unknown Type"}
                  </span>

                  <h2 className="text-xl md:text-2xl font-medium text-slate-900 mb-3 leading-tight line-clamp-3">
                    {selectedBook.Title}
                  </h2>

                  <div className="space-y-2.5 mt-4 text-sm text-slate-600">
                    <p className="flex justify-between border-b border-slate-100 pb-2">
                      <span className="text-slate-500">Publisher</span>
                      <span className="text-right ml-4 text-slate-800 font-medium line-clamp-1">{selectedBook.Publisher || "N/A"}</span>
                    </p>
                    <p className="flex justify-between border-b border-slate-100 pb-2">
                      <span className="text-slate-500">Year</span>
                      <span className="text-slate-800 font-medium">{selectedBook["Publication Year"] || "N/A"}</span>
                    </p>
                  </div>

                  {selectedBook.Link && (
                    <a
                      href={selectedBook.Link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-6 flex items-center justify-center w-full md:w-auto md:inline-flex md:mr-auto gap-2 py-2.5 px-6 bg-slate-900 text-white font-medium text-sm rounded-lg hover:bg-slate-800 transition-colors shadow-sm"
                    >
                      View in Library Catalog
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mouse Controls explanation - placed on the right side of the screen (desktop only). Now using explicit mouse-left / mouse-right button icons. */}
      {!loading && !error && (
        <div className="hidden md:block absolute right-6 bottom-8 z-10 pointer-events-auto">
          <div className="bg-white/90 backdrop-blur-md border border-amber-900/10 rounded-full px-3 py-1.5 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] text-[10px] text-slate-600 flex items-center gap-x-3">
            <div className="flex items-center gap-1.5 pr-2 border-r border-slate-200/70">
              <Mouse className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-semibold text-slate-700 tracking-tight">Mouse</span>
            </div>
            <div className="flex items-center gap-x-2.5">
              {/* Mouse Left Button (left side of mouse) for axis rotation */}
              <div className="flex items-center gap-1" title="滑鼠左鍵 (Mouse Left Button) 拖曳：以書架軸心旋轉">
                <span className="font-mono text-[9px] font-bold bg-slate-100 text-slate-500 px-1 rounded">L</span>
                {/* mouse-left icon: mouse outline + vertical button divider + short horizontal mark ONLY on the LEFT button area */}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-amber-700">
                  <path d="M12 2a6 6 0 0 1 6 6v8a6 6 0 0 1-6 6 6 6 0 0 1-6-6V8a6 6 0 0 1 6-6Z" />
                  <path d="M12 2v8" />
                  <path d="M7.2 5.5 h4.2" />
                </svg>
                <span className="text-slate-600">軸心旋轉</span>
              </div>
              {/* Mouse Right Button (right side of mouse) for pan */}
              <div className="flex items-center gap-1" title="滑鼠右鍵 (Mouse Right Button) 拖曳：平移視角">
                <span className="font-mono text-[9px] font-bold bg-slate-100 text-slate-500 px-1 rounded">R</span>
                {/* mouse-right icon: mouse outline + vertical button divider + short horizontal mark ONLY on the RIGHT button area */}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-amber-700">
                  <path d="M12 2a6 6 0 0 1 6 6v8a6 6 0 0 1-6 6 6 6 0 0 1-6-6V8a6 6 0 0 1 6-6Z" />
                  <path d="M12 2v8" />
                  <path d="M13 4.8 h4" />
                </svg>
                <span className="text-slate-600">平移</span>
              </div>
              {/* Scroll wheel up/down for zoom */}
              <div className="flex items-center gap-1" title="滾輪 (Scroll Wheel) 上下：縮放">
                <ArrowUpDown className="w-3.5 h-3.5 text-amber-700" />
                <span className="text-slate-600">縮放</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 手機觸控提示 - 只在非打開書籍狀態下與底部按鈕一起出現 */}
      {!loading && !error && !selectedBook && (
        <div className="md:hidden absolute left-1/2 -translate-x-1/2 bottom-9 z-20 pointer-events-auto">
          <div className="text-[8px] tracking-[0.5px] text-slate-500/70 bg-white/60 px-2.5 py-px rounded-full shadow-sm">拖曳旋轉 • 雙指縮放 • 點擊書籍</div>
        </div>
      )}

      {/* Control Buttons - horizontal single row at bottom center 
          只在「非打開書籍狀態」(!selectedBook) 下顯示，確保手機與桌面都能「一定會顯示」 */}
      {!loading && !error && !selectedBook && (
        <div className="absolute bottom-3 md:bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center pointer-events-auto">
          <div className="bg-white/90 backdrop-blur-md border border-amber-900/10 rounded-full p-1 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] flex items-center gap-0.5 scale-[0.88] md:scale-100">
            <button 
              title={autoRotate ? "Pause Auto-Rotate" : "Start Auto-Rotate"} 
              onClick={() => setAutoRotate(!autoRotate)} 
              className="p-1.5 hover:bg-slate-100 active:bg-slate-200 rounded-full text-slate-700 transition-colors"
            >
              {autoRotate ? <Pause className="w-4 h-4"/> : <Play className="w-4 h-4"/>}
            </button>
            <div className="w-px h-3.5 bg-slate-200/80 mx-0.5" />
            <button title="Rotate Left" onClick={() => handleControl('rotate-left')} className="p-1.5 hover:bg-slate-100 active:bg-slate-200 rounded-full text-slate-700 transition-colors">
              <ArrowLeft className="w-4 h-4"/>
            </button>
            <button title="Rotate Right" onClick={() => handleControl('rotate-right')} className="p-1.5 hover:bg-slate-100 active:bg-slate-200 rounded-full text-slate-700 transition-colors">
              <ArrowRight className="w-4 h-4"/>
            </button>
            <div className="w-px h-3.5 bg-slate-200/80 mx-0.5" />
            <button title="Elevate Up" onClick={() => handleControl('move-up')} className="p-1.5 hover:bg-slate-100 active:bg-slate-200 rounded-full text-slate-700 transition-colors">
              <ArrowUp className="w-4 h-4"/>
            </button>
            <button title="Elevate Down" onClick={() => handleControl('move-down')} className="p-1.5 hover:bg-slate-100 active:bg-slate-200 rounded-full text-slate-700 transition-colors">
              <ArrowDown className="w-4 h-4"/>
            </button>
            <div className="w-px h-3.5 bg-slate-200/80 mx-0.5" />
            <button title="Zoom Out" onClick={() => handleControl('zoom-out')} className="p-1.5 hover:bg-slate-100 active:bg-slate-200 rounded-full text-slate-700 transition-colors">
              <ZoomOut className="w-4 h-4"/>
            </button>
            <button title="Zoom In" onClick={() => handleControl('zoom-in')} className="p-1.5 hover:bg-slate-100 active:bg-slate-200 rounded-full text-slate-700 transition-colors">
              <ZoomIn className="w-4 h-4"/>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
