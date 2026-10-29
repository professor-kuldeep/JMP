import React from 'react';
import { inlineSpans } from '../lib/formatting.mjs';

// Render nested formatting as React nodes; HTML is never injected.
function inline(text, prefix = 'i', depth = 0, allowLinks = true) {
  if (depth > 8) return text;
  const candidates = [];
  for (const [tool, tag] of [['bold','strong'], ['italic','em'], ['underline','u'], ['strike','del'], ['code','code']]) {
    for (const span of inlineSpans(text, tool)) candidates.push({ ...span, tag });
  }
  for (const match of text.matchAll(/\[([^\]\n]+)\]\(((?:https?:\/\/|\/(?!\/)|#|mailto:|tel:)[^\s)]+)\)/g)) candidates.push({ open: match.index, after: match.index + match[0].length, label: match[1], href: match[2] });
  candidates.sort((a,b) => a.open - b.open || b.after - a.after);
  const nodes = []; let last = 0;
  for (const span of candidates) {
    if (span.open < last) continue;
    if (span.open > last) nodes.push(text.slice(last, span.open));
    const key = `${prefix}-${span.open}`;
    if (span.href && !allowLinks) nodes.push(...inline(span.label,key,depth+1,false));
    else if (span.href) nodes.push(<a key={key} href={span.href} target={span.href.startsWith('http') ? '_blank' : undefined} rel={span.href.startsWith('http') ? 'noopener noreferrer' : undefined}>{inline(span.label, key, depth + 1, allowLinks)}</a>);
    else nodes.push(React.createElement(span.tag, {key}, span.tag === 'code' ? text.slice(span.start, span.end) : inline(text.slice(span.start, span.end), key, depth + 1, allowLinks)));
    last = span.after;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export default function FormattedText({ text = '', className = '', allowLinks = true }) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (/^```/.test(line)) {
      const code = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
      i++;
      blocks.push(<pre key={blocks.length}><code>{code.join('\n')}</code></pre>); continue;
    }
    if (/^---+$/.test(line.trim())) { blocks.push(<hr key={blocks.length}/>); i++; continue; }
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      const level = Math.min(heading[1].length + 1, 6);
      blocks.push(React.createElement(`h${level}`, { key: blocks.length }, inline(heading[2], String(i),0,allowLinks))); i++; continue;
    }
    if (/^>\s?/.test(line)) {
      const parts=[]; while(i < lines.length && /^>\s?/.test(lines[i])) parts.push(lines[i++].replace(/^>\s?/, ''));
      blocks.push(<blockquote key={blocks.length}>{parts.map((part, n) => <p key={n}>{inline(part, `${i}-${n}`,0,allowLinks)}</p>)}</blockquote>); continue;
    }
    const unordered = /^\s*[-*+]\s+/.test(line);
    const ordered = /^\s*\d+\.\s+/.test(line);
    if (unordered || ordered) {
      const items=[]; const re = unordered ? /^\s*[-*+]\s+/ : /^\s*\d+\.\s+/;
      while(i < lines.length && re.test(lines[i])) items.push(lines[i++].replace(re,''));
      const ListTag = unordered ? 'ul' : 'ol';
      blocks.push(<ListTag key={blocks.length}>{items.map((item,n)=><li key={n}>{inline(item, `${i}-${n}`,0,allowLinks)}</li>)}</ListTag>); continue;
    }
    const para=[];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|>\s?|```|\s*[-*+]\s+|\s*\d+\.\s+|---+$)/.test(lines[i])) para.push(lines[i++]);
    if (!para.length) { i++; continue; }
    blocks.push(<p key={blocks.length}>{para.map((part,n)=><React.Fragment key={n}>{n > 0 && <br/>}{inline(part,`${i}-${n}`,0,allowLinks)}</React.Fragment>)}</p>);
  }
  return <div className={`formatted-text ${className}`.trim()}>{blocks}</div>;
}
