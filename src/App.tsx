import { useState, useEffect, useRef } from "react";
import { BookData } from "./types";
import { fetchBooks } from "./lib/data";
import { LibraryScene } from "./components/LibraryScene";
import { motion, AnimatePresence } from "motion/react";
import { Loader2, X, ExternalLink, BookOpen, ZoomIn, ZoomOut, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Play, Pause, Search, ChevronDown, Mouse, ArrowUpDown, Music, Move, SkipBack, SkipForward } from "lucide-react";

export default function App() {
  const [books, setBooks] = useState<BookData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBook, setSelectedBook] = useState<BookData | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);

  // Jukebox – minimal playlist (a01, a02, …)
  const [isJukeboxPlaying, setIsJukeboxPlaying] = useState(false);
  const jukeboxAudioRef = useRef<HTMLAudioElement>(null);

  const JUKEBOX_TRACKS = [
    {
      id: "a01",
      title: "更上一層樓 (節錄自:九十年代香港劇壇點將錄. 第二輯)",
      url: "https://firebasestorage.googleapis.com/v0/b/orientation2026-5dcd5.firebasestorage.app/o/MiniMax_2026-06-02_15_38_52_Mo_sir_2.mp3?alt=media&token=27996fdb-c016-4068-b346-77dbb9e36e0b"
    },
    {
      id: "a02",
      title: "何謂大眾劇場？(節錄自: 一堂無止境的課：毛俊輝的戲劇人生)",
      url: "https://firebasestorage.googleapis.com/v0/b/orientation2026-5dcd5.firebasestorage.app/o/minimax_tts_1781252882781.mp3?alt=media&token=c7532cfd-3e01-489a-b571-19a5b76c28ac"
    }
  ] as const;

  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const currentTrack = JUKEBOX_TRACKS[currentTrackIndex];

  // Jukebox player state
  const [jukeboxCurrentTime, setJukeboxCurrentTime] = useState(0);
  const [jukeboxDuration, setJukeboxDuration] = useState(0);

  const [isControlsPanelOpen, setIsControlsPanelOpen] = useState(false);
  const [isJukeboxOpen, setIsJukeboxOpen] = useState(false);

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

  const toggleJukebox = () => {
    const audio = jukeboxAudioRef.current;
    if (!audio) return;
    if (isJukeboxPlaying) {
      audio.pause();
      setIsJukeboxPlaying(false);
    } else {
      audio.play().then(() => setIsJukeboxPlaying(true)).catch((e) => console.error("Jukebox play failed:", e));
    }
  };

  // Switch to another track in the minimal playlist
  const switchTrack = (index: number) => {
    if (index === currentTrackIndex) return;
    const audio = jukeboxAudioRef.current;
    const wasPlaying = isJukeboxPlaying;
    if (audio) audio.pause();
    setCurrentTrackIndex(index);
    setIsJukeboxPlaying(false);
    setJukeboxCurrentTime(0);

    if (wasPlaying) {
      setTimeout(() => {
        const a = jukeboxAudioRef.current;
        if (a) {
          a.play().then(() => setIsJukeboxPlaying(true)).catch((e) => console.error("Jukebox play failed:", e));
        }
      }, 50);
    }
  };

  // Player controls helpers
  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const seekTo = (time: number) => {
    const audio = jukeboxAudioRef.current;
    if (!audio) return;
    audio.currentTime = time;
    setJukeboxCurrentTime(time);
  };

  const goToPrevTrack = () => {
    const newIndex = (currentTrackIndex - 1 + JUKEBOX_TRACKS.length) % JUKEBOX_TRACKS.length;
    switchTrack(newIndex);
  };

  const goToNextTrack = () => {
    const newIndex = (currentTrackIndex + 1) % JUKEBOX_TRACKS.length;
    switchTrack(newIndex);
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
    setIsControlsPanelOpen(false);
    setIsJukeboxOpen(false);
  };

  // Attach audio event listeners once the component mounts
  useEffect(() => {
    const audio = jukeboxAudioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setJukeboxCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => {
      setJukeboxDuration(audio.duration || 0);
      setJukeboxCurrentTime(audio.currentTime);
    };
    const onEnded = () => {
      setIsJukeboxPlaying(false);
      // Auto-advance to next track (optional – comment out if you prefer manual)
      // goToNextTrack();
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

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
              <span className="text-3xl md:text-4xl">Mo Sir談天說藝</span>
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

      {/* Two floating buttons centered at the very bottom of the screen (side-by-side).
          Jukebox on the right of the pair, Camera Controls on the left of the pair.
          Cards expand upward above their respective buttons. Hidden when a book overlay is open.
          Only one card can be open at a time (mutual close on toggle).
          Uses safe-area-inset-bottom for iOS devices (iPhone home indicator) + high z-index. */}
      {!loading && !error && !selectedBook && (
        <div
          className="absolute left-1/2 -translate-x-1/2 z-[90] pointer-events-auto flex items-end gap-3"
          style={{ bottom: `calc(1rem + env(safe-area-inset-bottom, 0px))` }}
        >
          {/* Camera Controls group */}
          <div className="flex flex-col items-center gap-2">
            <AnimatePresence>
              {isControlsPanelOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.96 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="relative bg-white/95 backdrop-blur-xl border border-amber-900/10 rounded-3xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] px-4 py-3 w-[min(92vw,340px)] text-[11px] text-slate-600"
                >
                  <button
                    onClick={() => setIsControlsPanelOpen(false)}
                    className="absolute top-2 right-2 p-1 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100"
                    title="Close"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>

                  <div className="text-[9px] font-semibold text-slate-500 mb-1.5 tracking-wider pr-5">Camera Controls</div>
                  <div className="flex items-center justify-center flex-wrap gap-1">
                    {/* Auto-rotate toggle */}
                    <button
                      title={autoRotate ? "Pause Auto-Rotate" : "Start Auto-Rotate"}
                      onClick={() => setAutoRotate(!autoRotate)}
                      className="p-1.5 hover:bg-slate-100 active:bg-slate-200 rounded-full text-slate-700 transition-colors"
                    >
                      {autoRotate ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>

                    <div className="w-px h-3.5 bg-slate-200/70 mx-0.5" />

                    {/* Rotate around shelf axis */}
                    <button title="Rotate Left" onClick={() => handleControl("rotate-left")} className="p-1.5 hover:bg-slate-100 active:bg-slate-200 rounded-full text-slate-700 transition-colors">
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <button title="Rotate Right" onClick={() => handleControl("rotate-right")} className="p-1.5 hover:bg-slate-100 active:bg-slate-200 rounded-full text-slate-700 transition-colors">
                      <ArrowRight className="w-4 h-4" />
                    </button>

                    <div className="w-px h-3.5 bg-slate-200/70 mx-0.5" />

                    {/* Vertical elevate */}
                    <button title="Elevate Up" onClick={() => handleControl("move-up")} className="p-1.5 hover:bg-slate-100 active:bg-slate-200 rounded-full text-slate-700 transition-colors">
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button title="Elevate Down" onClick={() => handleControl("move-down")} className="p-1.5 hover:bg-slate-100 active:bg-slate-200 rounded-full text-slate-700 transition-colors">
                      <ArrowDown className="w-4 h-4" />
                    </button>

                    <div className="w-px h-3.5 bg-slate-200/70 mx-0.5" />

                    {/* Zoom */}
                    <button title="Zoom Out" onClick={() => handleControl("zoom-out")} className="p-1.5 hover:bg-slate-100 active:bg-slate-200 rounded-full text-slate-700 transition-colors">
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <button title="Zoom In" onClick={() => handleControl("zoom-in")} className="p-1.5 hover:bg-slate-100 active:bg-slate-200 rounded-full text-slate-700 transition-colors">
                      <ZoomIn className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Controls trigger button */}
            <button
              onClick={() => {
                setIsControlsPanelOpen(!isControlsPanelOpen);
                setIsJukeboxOpen(false);
              }}
              className="w-10 h-10 rounded-full bg-white/90 backdrop-blur border border-amber-900/10 shadow-[0_6px_16px_-4px_rgba(0,0,0,0.18)] flex items-center justify-center text-amber-700 hover:bg-white active:scale-[0.92] transition-all"
              title="Camera Controls"
            >
              <Move className="w-4 h-4" />
            </button>
          </div>

          {/* Jukebox group */}
          <div className="flex flex-col items-center gap-2">
            <AnimatePresence>
              {isJukeboxOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="relative bg-white/95 backdrop-blur-md border border-amber-900/10 rounded-2xl px-4 py-3 shadow-[0_10px_30px_-8px_rgba(0,0,0,0.2)] text-xs text-slate-600 w-[min(85vw,320px)]"
                >
                  <button
                    onClick={() => setIsJukeboxOpen(false)}
                    className="absolute top-1.5 right-1.5 text-slate-400 hover:text-slate-700 p-0.5 rounded-full hover:bg-slate-100"
                    title="Close"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <div className="flex items-start gap-3 pr-6">
                    <Music className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-700 tracking-tight">Jukebox</div>
                      <div className="text-slate-600 text-sm leading-snug line-clamp-2 mt-0.5" title={currentTrack.title}>
                        {currentTrack.title}
                      </div>
                    </div>
                  </div>

                  {/* Playlist – clean vertical list with full titles */}
                  <div className="mt-3 mb-2">
                    <div className="text-[10px] font-semibold text-slate-400 px-1 mb-1">Playlist</div>
                    <div className="flex flex-col gap-0.5">
                      {JUKEBOX_TRACKS.map((track, idx) => (
                        <button
                          key={track.id}
                          onClick={() => switchTrack(idx)}
                          className={`w-full text-left px-3 py-1.5 rounded-lg border transition-all flex items-center gap-2 ${idx === currentTrackIndex ? "bg-amber-100 border-amber-300 text-amber-900" : "border-transparent hover:bg-amber-50 text-slate-600"}`}
                        >
                          <span className="font-mono text-[10px] text-amber-600 w-6 shrink-0">{track.id.toUpperCase()}</span>
                          <span className="text-xs leading-tight line-clamp-2 pr-1">{track.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Player controls: progress + time + prev/play/next */}
                  <div className="mt-3 pt-2 border-t border-amber-100">
                    <div className="flex items-center gap-2 px-1">
                      <span className="font-mono text-[10px] text-amber-700 w-9 text-right">{formatTime(jukeboxCurrentTime)}</span>

                      <input
                        type="range"
                        min={0}
                        max={jukeboxDuration || 100}
                        step={0.1}
                        value={jukeboxCurrentTime}
                        onChange={(e) => seekTo(parseFloat(e.target.value))}
                        className="flex-1 accent-amber-600 cursor-pointer"
                      />

                      <span className="font-mono text-[10px] text-amber-700 w-9">{formatTime(jukeboxDuration)}</span>
                    </div>

                    <div className="mt-2 flex items-center justify-center gap-4">
                      <button
                        onClick={goToPrevTrack}
                        className="p-1.5 text-amber-700 hover:bg-amber-100 rounded-full transition-colors"
                        title="上一首"
                      >
                        <SkipBack className="w-4 h-4" />
                      </button>

                      <button
                        onClick={toggleJukebox}
                        className="inline-flex items-center gap-1.5 pl-3 pr-3.5 py-1.5 rounded-full bg-amber-100 hover:bg-amber-200 active:bg-amber-300 text-amber-800 text-xs font-medium transition-colors shadow-sm"
                        title={isJukeboxPlaying ? "Pause" : "Play"}
                      >
                        {isJukeboxPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        <span>{isJukeboxPlaying ? "暫停" : "播放"}</span>
                      </button>

                      <button
                        onClick={goToNextTrack}
                        className="p-1.5 text-amber-700 hover:bg-amber-100 rounded-full transition-colors"
                        title="下一首"
                      >
                        <SkipForward className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 flex justify-end gap-2">
                    {/* Minimal "前往該書" button – jumps to the book that owns the current audio excerpt */}
                    {books.some(b => b.audio === currentTrack.id) && (
                      <button
                        onClick={() => {
                          const target = books.find(b => b.audio === currentTrack.id);
                          if (target) handleSelectBook(target);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-amber-300 hover:bg-amber-50 active:bg-amber-100 text-amber-700 text-xs font-medium transition-colors"
                        title="前往對應書本"
                      >
                        前往該書
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Jukebox trigger button (shows Pause icon while audio playing) */}
            <button
              onClick={() => {
                setIsJukeboxOpen(!isJukeboxOpen);
                setIsControlsPanelOpen(false);
              }}
              className="w-10 h-10 rounded-full bg-white/90 backdrop-blur border border-amber-900/10 shadow-[0_6px_16px_-4px_rgba(0,0,0,0.18)] flex items-center justify-center text-amber-700 hover:bg-white active:scale-[0.92] transition-all"
              title="Jukebox"
            >
              {isJukeboxPlaying ? <Pause className="w-4 h-4" /> : <Music className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {/* Hidden <audio> element – src is reactive to the current playlist track */}
      <audio
        ref={jukeboxAudioRef}
        src={currentTrack.url}
        onPlay={() => setIsJukeboxPlaying(true)}
        onPause={() => setIsJukeboxPlaying(false)}
        onEnded={() => setIsJukeboxPlaying(false)}
      />
    </div>
  );
}
