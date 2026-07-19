export function RawBlock({ text }: { text: string }) {
  return (
    <div className="font-mono text-xs text-emerald-600 dark:text-emerald-300/80 whitespace-pre-wrap leading-relaxed">
      {text}
    </div>
  );
}