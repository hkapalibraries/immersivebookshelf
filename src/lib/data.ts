import Papa from "papaparse";
import { BookData } from "../types";

export const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTdagPHS6INxivQT2jS9aQA6fsbKyWpHCPJhnAEubMigdVkf40yb2Hbaddlaw6hQYjGrgNYq124XfNK/pub?output=csv";

// Small built-in fallback so the 3D cover logic can be tested even when the Google published CSV is temporarily returning HTML / rate-limited / empty.
// Put real direct image links (i.ibb.co/...jpg etc.) in the cover field.
const FALLBACK_BOOKS: BookData[] = [
  {
    Title: "阿茜的救國夢",
    Publisher: "測試出版社",
    "Publication Year": "2023",
    "Material Type": "書籍",
    Link: "",
    cover: "https://i.ibb.co/gMdH26fJ/61-ZKNw0xix-L-AC-UF1000-1000-QL80.jpg"
  },
  {
    Title: "戲劇香港 : 香港戲劇",
    Publisher: "香港藝術中心",
    "Publication Year": "2019",
    "Material Type": "書籍",
    Link: "",
    cover: "https://i.ibb.co/QvxMhX7Y/book-covers-big-2019101610.jpg" // note: this was a composite; replace with single book cover when possible
  },
  {
    Title: "測試書 A (有封面)",
    Publisher: "Demo",
    "Publication Year": "2024",
    "Material Type": "PHOTOCOPY",
    Link: "",
    cover: "https://i.ibb.co/SwZBHJDV" // placeholder - user should replace with a real direct jpg
  },
  {
    Title: "測試書 B (無封面)",
    Publisher: "Demo",
    "Publication Year": "2021",
    "Material Type": "書籍",
    Link: "",
    cover: ""
  }
];

function looksLikeHtml(s: string): boolean {
  const head = (s || "").trim().slice(0, 200).toLowerCase();
  return head.startsWith("<") || head.includes("<html") || head.includes("<!doctype");
}

export async function fetchBooks(): Promise<BookData[]> {
  try {
    // First do a lightweight fetch so we can detect when Google serves HTML instead of CSV (very common with pub?output=csv links).
    const headRes = await fetch(CSV_URL, { method: "GET", cache: "no-store" });
    const text = await headRes.text();

    if (!headRes.ok || looksLikeHtml(text)) {
      console.warn("[data] Google Sheets CSV endpoint returned HTML or error. Using built-in FALLBACK_BOOKS so you can still test cover textures. To use your real data: publish your sheet as CSV and give me the link.");
      return FALLBACK_BOOKS;
    }

    // Real CSV path
    return await new Promise((resolve, reject) => {
      Papa.parse(CSV_URL, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          let rows = (results.data || []) as BookData[];

          // Normalize possible header variations for the cover column (Google Sheets users often use "Cover", "封面", etc.)
          rows = rows.map((r: any) => {
            if (!r.cover && r.Cover) r.cover = r.Cover;
            if (!r.cover && r["封面"]) r.cover = r["封面"];
            if (!r.cover && r["Cover URL"]) r.cover = r["Cover URL"];
            // also trim obvious junk
            if (r.cover && typeof r.cover === "string" && r.cover.includes("<")) r.cover = "";

            // Normalize optional audio column (a01, a02, …)
            if (!r.audio && r.Audio) r.audio = r.Audio;
            if (!r.audio && r["音檔"]) r.audio = r["音檔"];
            if (!r.audio && r["Audio ID"]) r.audio = r["Audio ID"];
            if (r.audio && typeof r.audio === "string" && r.audio.includes("<")) r.audio = "";
            return r as BookData;
          });

          // If after parsing we got almost no real titles, fall back
          const valid = rows.filter((b) => b.Title && b.Title.trim() !== "");
          if (valid.length < 2) {
            console.warn("[data] Parsed CSV had very few valid rows. Using FALLBACK_BOOKS for testing.");
            return resolve(FALLBACK_BOOKS);
          }

          // Warn about duplicate titles (can cause "loaded in log but wrong book shows fallback" because multiple BookNodes share the name)
          const titleCounts = new Map<string, number>();
          valid.forEach(b => {
            const t = b.Title.trim();
            titleCounts.set(t, (titleCounts.get(t) || 0) + 1);
          });
          const dups = Array.from(titleCounts.entries()).filter(([,c]) => c > 1);
          if (dups.length > 0) {
            console.warn("[data] Duplicate titles found in sheet (this can confuse which 3D book gets the cover):", dups.map(([t,c]) => `${t} (x${c})`));
          }

          resolve(valid);
        },
        error: (error: any) => reject(error),
      });
    });
  } catch (e) {
    console.warn("[data] fetchBooks failed to reach Google Sheets, using FALLBACK_BOOKS.", e);
    return FALLBACK_BOOKS;
  }
}
