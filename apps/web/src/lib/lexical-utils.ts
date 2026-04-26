/**
 * Returns true if the string looks like serialised Lexical JSON.
 */
export function isLexicalJson(value: string): boolean {
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null && "root" in parsed;
  } catch {
    return false;
  }
}

interface LexicalNode {
  type: string;
  text?: string;
  children?: LexicalNode[];
}

function extractText(node: LexicalNode): string {
  if (node.type === "text") return node.text ?? "";
  if (!node.children?.length) return "";
  const childText = node.children.map(extractText).join("");
  // Add newline after block-level nodes
  if (
    node.type === "paragraph" ||
    node.type === "heading" ||
    node.type === "listitem"
  ) {
    return childText + "\n";
  }
  return childText;
}

/**
 * Extracts plain text from a serialised Lexical JSON string.
 * Falls back to returning the raw value for plain-text descriptions.
 */
export function lexicalToPlainText(value: string | null | undefined): string {
  if (!value) return "";
  if (!isLexicalJson(value)) return value;
  try {
    const parsed = JSON.parse(value) as { root: LexicalNode };
    return extractText(parsed.root).trim();
  } catch {
    return value;
  }
}
