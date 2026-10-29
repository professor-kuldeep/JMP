// Pure Markdown editing operations shared by the toolbar and regression tests.
const markers = { bold: '**', italic: '*', underline: '++', strike: '~~', code: '`' };
const escaped = (text, at) => { let n = 0; while (at > 0 && text[--at] === '\\') n++; return n % 2 === 1; };
const selection = (text, start, end) => [Math.max(0, Math.min(text.length, start)), Math.max(0, Math.min(text.length, end))];

export function inlineSpans(text, tool) {
  const marker = markers[tool];
  if (!marker) return [];
  const re = tool === 'bold' || tool === 'italic' ? /\*+/g : tool === 'underline' ? /\++/g : tool === 'strike' ? /~+/g : /`+/g;
  const spans = []; let opening = null, match;
  while ((match = re.exec(text))) {
    const run = match[0], at = match.index;
    if (escaped(text, at) || run.length < marker.length || (tool === 'italic' && run.length % 2 === 0) || (tool === 'code' && run.length !== 1)) continue;
    const openAt = at + (tool === 'italic' ? run.length - 1 : 0);
    const closeAt = at + (marker.length === 2 ? run.length - 2 : 0);
    const canClose = at > 0 && !/\s/.test(text[at - 1]);
    const canOpen = at + run.length < text.length && !/\s/.test(text[at + run.length]);
    if (opening !== null && canClose) {
      const contentStart = opening + marker.length;
      if (closeAt > contentStart && !(tool === 'code' && text.slice(contentStart, closeAt).includes('\n'))) spans.push({ open: opening, close: closeAt, start: contentStart, end: closeAt, after: closeAt + marker.length });
      opening = null;
    } else if (canOpen) opening = openAt;
  }
  return spans;
}

const wrapped = (text, marker) => {
  if (!text.trim()) return text;
  const [, lead, middle, tail] = text.match(/^(\s*)([\s\S]*?)(\s*)$/);
  return lead + marker + middle + marker + tail;
};
function lineRange(text, start, end) {
  const from = start === 0 ? 0 : text.lastIndexOf('\n', start - 1) + 1;
  const edge = end > start && text[end - 1] === '\n' ? end - 1 : end;
  const next = text.indexOf('\n', edge);
  return [from, next === -1 ? text.length : next];
}

export function formattingState(text, start = 0, end = start) {
  const state = {};
  for (const key of Object.keys(markers)) state[key] = inlineSpans(text, key).some(s => start >= s.open && end <= s.after);
  const [from, to] = lineRange(text, start, end);
  const lines = text.slice(from, to).split('\n').filter(l => l.trim());
  state.h2 = lines.length > 0 && lines.every(l => /^#\s/.test(l));
  state.h3 = lines.length > 0 && lines.every(l => /^##\s/.test(l));
  state.bullet = lines.length > 0 && lines.every(l => /^\s*[-*+]\s/.test(l));
  state.number = lines.length > 0 && lines.every(l => /^\s*\d+\.\s/.test(l));
  state.quote = lines.length > 0 && lines.every(l => /^>\s?/.test(l));
  state.link = [...text.matchAll(/\[([^\]\n]+)\]\(([^\s)]+)\)/g)].some(m => start >= m.index && end <= m.index + m[0].length);
  return state;
}

export function applyFormatting(text, start, end, tool, url = '') {
  text = String(text || ''); [start, end] = selection(text, start, end);
  if (start > end) [start, end] = [end, start];
  const result = (value, from, to = from) => ({ value, start: from, end: to });
  if (markers[tool]) {
    const marker = markers[tool], size = marker.length;
    const span = inlineSpans(text, tool).find(s => start >= s.open && end <= s.after);
    if (span) {
      const from = Math.max(span.start, start), to = Math.min(span.end, end);
      if (start === end || start <= span.start && end >= span.end || /^[*+~`]*$/.test(text.slice(span.start, from) + text.slice(to, span.end))) {
        let inner = text.slice(span.start, span.end), removed = size;
        // Repair duplicate wrappers left by earlier versions of the toolbar.
        if (size === 2) while (inner.length > size * 2 && inner.startsWith(marker) && inner.endsWith(marker)) { inner = inner.slice(size, -size); removed += size; }
        const value = text.slice(0, span.open) + inner + text.slice(span.after);
        const nextStart = Math.max(span.open, Math.min(span.open + inner.length, start - removed));
        return result(value, nextStart, Math.max(nextStart, Math.min(span.open + inner.length, end - removed)));
      }
      const before = wrapped(text.slice(span.start, from), marker), chosen = text.slice(from, to), after = wrapped(text.slice(to, span.end), marker);
      return result(text.slice(0, span.open) + before + chosen + after + text.slice(span.after), span.open + before.length, span.open + before.length + chosen.length);
    }
    if (start === end) {
      const word = /[^\s*+~`[\]()]/;
      let from = start, to = start;
      while (from > 0 && word.test(text[from - 1])) from--;
      while (to < text.length && word.test(text[to])) to++;
      start = from; end = to;
    }
    const chosen = text.slice(start, end) || 'text';
    const [, lead, body, tail] = chosen.match(/^(\s*)([\s\S]*?)(\s*)$/);
    if (!body) return result(text, start, end);
    return result(text.slice(0, start) + lead + marker + body + marker + tail + text.slice(end), start + lead.length + size, start + lead.length + size + body.length);
  }
  if (['h2', 'h3', 'bullet', 'number', 'quote'].includes(tool)) {
    const [from, to] = lineRange(text, start, end);
    const lines = text.slice(from, to).split('\n');
    const active = formattingState(text, start, end)[tool]; let count = 0;
    const value = lines.map(line => {
      if (!line.trim()) return line;
      const isHeading = tool === 'h2' || tool === 'h3';
      const cleaned = isHeading ? line.replace(/^#{1,4}\s+/, '') : tool === 'quote' ? line.replace(/^>\s?/, '') : line.replace(/^\s*(?:[-*+]|\d+\.)\s+/, '');
      if (active) return cleaned;
      const prefix = tool === 'h2' ? '# ' : tool === 'h3' ? '## ' : tool === 'bullet' ? '- ' : tool === 'number' ? `${++count}. ` : '> ';
      return prefix + cleaned;
    }).join('\n');
    return result(text.slice(0, from) + value + text.slice(to), from, from + value.length);
  }
  if (tool === 'link') {
    const links = [...text.matchAll(/\[([^\]\n]+)\]\(([^\s)]+)\)/g)];
    const current = links.find(m => start >= m.index && end <= m.index + m[0].length);
    if (current) return result(text.slice(0, current.index) + current[1] + text.slice(current.index + current[0].length), current.index, current.index + current[1].length);
    if (!/^(https?:\/\/[^\s<>]+|\/(?!\/)[^\s<>]*|#[\w-]+|mailto:[^\s<>]+|tel:[+\d() -]+)$/.test(url) || /[()]/.test(url)) return result(text, start, end);
    const chosen = text.slice(start, end) || 'link text';
    return result(text.slice(0, start) + `[${chosen}](${url})` + text.slice(end), start + 1, start + chosen.length + 1);
  }
  if (tool === 'divider') {
    const insert = `${start > 0 && text[start - 1] !== '\n' ? '\n' : ''}\n---\n\n`;
    return result(text.slice(0, start) + insert + text.slice(end), start + insert.length);
  }
  if (tool === 'clear') {
    if (start === end) [start, end] = lineRange(text, start, end);
    let chosen = text.slice(start, end).replace(/^\s{0,3}(?:#{1,4}\s+|>\s?|[-*+]\s+|\d+\.\s+)/gm, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    for (let i = 0; i < 3; i++) chosen = chosen.replace(/(\*\*|\+\+|~~|`|\*)([^\n]*?)\1/g, '$2');
    return result(text.slice(0, start) + chosen + text.slice(end), start, start + chosen.length);
  }
  return result(text, start, end);
}
