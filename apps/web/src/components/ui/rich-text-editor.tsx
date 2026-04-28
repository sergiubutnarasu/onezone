"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListItemNode,
  ListNode,
} from "@lexical/list";
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  TRANSFORMERS,
} from "@lexical/markdown";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { $getSelection, $isRangeSelection, FORMAT_TEXT_COMMAND } from "lexical";
import { Bold, Italic, List, ListOrdered, Underline } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

const editorTheme = {
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

// ---------------------------------------------------------------------------
// Markdown change plugin
// ---------------------------------------------------------------------------

function MarkdownOnChangePlugin({
  onChange,
}: {
  onChange: (md: string) => void;
}) {
  const [editor] = useLexicalComposerContext();
  const onChangeRef = useRef(onChange);
  useLayoutEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    return editor.registerUpdateListener(
      ({ editorState, dirtyElements, dirtyLeaves }) => {
        if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return;
        editorState.read(() => {
          const markdown = $convertToMarkdownString(TRANSFORMERS);
          onChangeRef.current(markdown);
        });
      },
    );
  }, [editor]);

  return null;
}

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

function ToolbarPlugin() {
  const [editor] = useLexicalComposerContext();
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          setIsBold(selection.hasFormat("bold"));
          setIsItalic(selection.hasFormat("italic"));
          setIsUnderline(selection.hasFormat("underline"));
        }
      });
    });
  }, [editor]);

  return (
    <div className="flex items-center gap-0.5 px-1.5 py-1 border-b border-border/60 bg-muted/30">
      <Button
        type="button"
        size="icon-sm"
        variant={isBold ? "secondary" : "ghost"}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")}
        className="size-6"
        title="Bold (⌘B)"
      >
        <Bold className="size-3.5" />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant={isItalic ? "secondary" : "ghost"}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")}
        className="size-6"
        title="Italic (⌘I)"
      >
        <Italic className="size-3.5" />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant={isUnderline ? "secondary" : "ghost"}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline")}
        className="size-6"
        title="Underline (⌘U)"
      >
        <Underline className="size-3.5" />
      </Button>

      <div className="w-px h-4 bg-border mx-0.5" />

      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        onClick={() =>
          editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)
        }
        className="size-6"
        title="Bullet list"
      >
        <List className="size-3.5" />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        onClick={() =>
          editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)
        }
        className="size-6"
        title="Numbered list"
      >
        <ListOrdered className="size-3.5" />
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

interface RichTextEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  minHeight?: string;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Write something…",
  autoFocus = false,
  className,
  minHeight = "6rem",
}: RichTextEditorProps) {
  const initialConfig = {
    namespace: "RichTextEditor",
    theme: editorTheme,
    onError: (error: Error) => console.error(error),
    nodes: [ListNode, ListItemNode],
    editorState: () =>
      $convertFromMarkdownString(value ?? "", TRANSFORMERS),
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div
        className={cn(
          "border border-input rounded-md overflow-hidden text-sm focus-within:ring-1 focus-within:ring-ring",
          className,
        )}
      >
        <ToolbarPlugin />
        <div className="relative">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                autoFocus={autoFocus}
                className="outline-none p-3 text-sm"
                style={{ minHeight }}
              />
            }
            placeholder={
              <div
                className="absolute top-3 left-3 text-sm text-muted-foreground pointer-events-none select-none"
                aria-hidden
              >
                {placeholder}
              </div>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
      </div>
      <HistoryPlugin />
      <ListPlugin />
      {onChange && <MarkdownOnChangePlugin onChange={onChange} />}
    </LexicalComposer>
  );
}
