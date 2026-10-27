import React from 'react';

// Safe, small Markdown renderer: text is rendered as React nodes, never injected as HTML.
function inline(text, prefix = 'i') {
  const pattern = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[\w\-/?.#=&%]+|#[\w-]+)\)|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|~~([^~\n]+)~~|\+\+([^+\n]+)\+\+|`([^`\n]+)`)/g;
  let match, last = 0, index = 0;
  const nodes = [];
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const key = `${prefix}-${index++}`;
    if (match[2]) nodes.push(<a key={key} href={match[3]} rel={match[3].startsWith('http') ? 'noopener noreferrer' : undefined} target={match[3].startsWith('http') ? '_blank' : undefined}>{match[2]}</a>);
    else if (match[4]) nodes.push(<strong key={key}>{match[4]}</strong>);
    else if (match[5]) nodes.push(<em key={key}>{match[5]}</em>);
    else if (match[6]) nodes.push(<del key={key}>{match[6]}</del>);
    else if (match[7]) nodes.push(<u key={key}>{match[7]}</u>);
    else if (match[8]) nodes.push(<code key={key}>{match[8]}</code>);
    last = pattern.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export default function FormattedText({ text = '', className = '' }) {
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
      blocks.push(React.createElement(`h${level}`, { key: blocks.length }, inline(heading[2], String(i)))); i++; continue;
    }
    if (/^>\s?/.test(line)) {
      const parts=[]; while(i < lines.length && /^>\s?/.test(lines[i])) parts.push(lines[i++].replace(/^>\s?/, ''));
      blocks.push(<blockquote key={blocks.length}>{parts.map((part, n) => <p key={n}>{inline(part, `${i}-${n}`)}</p>)}</blockquote>); continue;
    }
    const unordered = /^\s*[-*+]\s+/.test(line);
    const ordered = /^\s*\d+\.\s+/.test(line);
    if (unordered || ordered) {
      const items=[]; const re = unordered ? /^\s*[-*+]\s+/ : /^\s*\d+\.\s+/;
      while(i < lines.length && re.test(lines[i])) items.push(lines[i++].replace(re,''));
      const ListTag = unordered ? 'ul' : 'ol';
      blocks.push(<ListTag key={blocks.length}>{items.map((item,n)=><li key={n}>{inline(item, `${i}-${n}`)}</li>)}</ListTag>); continue;
    }
    const para=[];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|>\s?|```|\s*[-*+]\s+|\s*\d+\.\s+|---+$)/.test(lines[i])) para.push(lines[i++]);
    if (!para.length) { i++; continue; }
    blocks.push(<p key={blocks.length}>{para.map((part,n)=><React.Fragment key={n}>{n > 0 && <br/>}{inline(part,`${i}-${n}`)}</React.Fragment>)}</p>);
  }
  return <div className={`formatted-text ${className}`.trim()}>{blocks}</div>;
}
