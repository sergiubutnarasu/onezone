"use client";

import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { ListNode, ListItemNode } from "@lexical/list";
import { cn } from "@/lib/utils";
import { isLexicalJson } from "@/lib/lexical-utils";
import {
  $getRoot,
  $createParagraphNode,
  $createTextNode,
} from "lexical";

const viewerTheme = {
  list: {
    ul: "list-disc pl-5 my-1",
    ol: "list-decimal pl-5 my-1",
    listitem: "my-0.5",
    nested: {
      listitem: "list-none",
    },
  },
  text: {
    bold: "font-bold",
    italic: "italic",
    underline: "underline",
    strikethrough: "line-through",
    code: "font-mono bg-muted px-1 rounded text-xs",
  },
  paragraph: "mb-1 last:mb-0",
};

interface RichTextViewerProps {
  value?: string | null;
  className?: string;
}

export function RichTextViewer({ value, className }: RichTextViewerProps) {
  if (!value) return null;

  const initialConfig = {
    namespace: "RichTextViewer",
    editable: false,
    theme: viewerTheme,
    onError: (error: Error) => console.error(error),
    nodes: [ListNode, ListItemNode],
    editorState: isLexicalJson(value)
      ? value
      : () => {
          const root = $getRoot();
          if (root.getFirstChild() === null) {
            const p = $createParagraphNode();
            p.append($createTextNode(value));
            root.append(p);
          }
        },
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <RichTextPlugin
        contentEditable={
          <ContentEditable
            className={cn("outline-none text-sm", className)}
          />
        }
        placeholder={null}
        ErrorBoundary={LexicalErrorBoundary}
      />
      <ListPlugin />
    </LexicalComposer>
  );
}
