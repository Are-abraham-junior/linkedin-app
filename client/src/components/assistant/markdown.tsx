import React from "react";

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${i++}`;
    if (token.startsWith("**")) nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    else if (token.startsWith("`")) nodes.push(<code key={key} className="px-1 py-0.5 rounded bg-surface-2 text-xs">{token.slice(1, -1)}</code>);
    else if (token.startsWith("[")) nodes.push(<a key={key} href={match[3]} target="_blank" rel="noreferrer" className="text-ink underline">{match[2]}</a>);
    else nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** Rendu Markdown minimal et sûr (pas de HTML brut) : gras, italique, code, liens, listes, titres. */
export function renderMarkdown(text: string): React.ReactNode {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushList = () => {
    if (!list) return;
    const key = `l-${blocks.length}`;
    const items = list.items.map((item, i) => <li key={`${key}-${i}`}>{renderInline(item, `${key}-${i}`)}</li>);
    blocks.push(list.ordered ? <ol key={key} className="list-decimal pl-5 space-y-0.5">{items}</ol> : <ul key={key} className="list-disc pl-5 space-y-0.5">{items}</ul>);
    list = null;
  };

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const heading = line.match(/^#{1,4}\s+(.*)$/);

    if (bullet) {
      if (!list || list.ordered) {
        flushList();
        list = { ordered: false, items: [] };
      }
      list.items.push(bullet[1]);
      return;
    }
    if (numbered) {
      if (!list || !list.ordered) {
        flushList();
        list = { ordered: true, items: [] };
      }
      list.items.push(numbered[1]);
      return;
    }
    flushList();
    if (!line.trim()) return;
    if (heading) {
      blocks.push(<p key={`h-${idx}`} className="font-medium text-ink">{renderInline(heading[1], `h-${idx}`)}</p>);
      return;
    }
    blocks.push(<p key={`p-${idx}`}>{renderInline(line, `p-${idx}`)}</p>);
  });
  flushList();

  return <div className="space-y-1.5">{blocks}</div>;
}
