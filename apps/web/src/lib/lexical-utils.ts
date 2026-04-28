/**
 * Extracts a plain-text preview from a markdown string.
 * Strips common markdown syntax so the home-page card shows readable text.
 */
export function lexicalToPlainText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/^#{1,6}\s+/gm, "")      // headings
    .replace(/\*\*(.+?)\*\*/g, "$1")  // bold
    .replace(/\*(.+?)\*/g, "$1")      // italic
    .replace(/~~(.+?)~~/g, "$1")      // strikethrough
    .replace(/`(.+?)`/g, "$1")        // inline code
    .replace(/^[*-]\s+/gm, "")        // unordered list bullets
    .replace(/^\d+\.\s+/gm, "")       // ordered list numbers
    .trim();
}
