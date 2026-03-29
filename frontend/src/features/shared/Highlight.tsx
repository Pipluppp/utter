export interface HighlightProps {
  text: string;
  tokens: string[];
}

export function Highlight({ text, tokens }: HighlightProps) {
  if (tokens.length === 0) return <>{text}</>;
  const lower = text.toLowerCase();
  const ranges: Array<[number, number]> = [];
  for (const t of tokens) {
    const needle = t.toLowerCase();
    if (!needle) continue;
    let idx = 0;
    while (idx < lower.length) {
      const found = lower.indexOf(needle, idx);
      if (found === -1) break;
      ranges.push([found, found + needle.length]);
      idx = found + needle.length;
    }
  }
  if (ranges.length === 0) return <>{text}</>;
  ranges.sort((a, b) => a[0] - b[0]);

  const merged: Array<[number, number]> = [];
  for (const r of ranges) {
    const prev = merged[merged.length - 1];
    if (!prev || r[0] > prev[1]) merged.push(r);
    else prev[1] = Math.max(prev[1], r[1]);
  }

  const out: React.ReactNode[] = [];
  let cursor = 0;
  merged.forEach(([s, e]) => {
    if (cursor < s) out.push(<span key={`t-${cursor}-${s}`}>{text.slice(cursor, s)}</span>);
    out.push(
      <mark key={`m-${s}-${e}`} className="bg-foreground text-background px-0.5">
        {text.slice(s, e)}
      </mark>,
    );
    cursor = e;
  });
  if (cursor < text.length) out.push(<span key={`t-${cursor}-end`}>{text.slice(cursor)}</span>);
  return <>{out}</>;
}
