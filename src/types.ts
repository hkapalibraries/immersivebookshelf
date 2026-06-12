export interface BookData {
  Title: string;
  Publisher: string;
  "Publication Year": string;
  "Material Type": string;
  Link: string;
  cover?: string;
  audio?: string;   // "a01", "a02", … (maps to audio excerpts)
}
