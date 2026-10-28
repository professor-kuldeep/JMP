'use client';
import { useEffect, useId, useRef, useState } from 'react';
import FormattedText from '../../components/FormattedText';
import { applyFormatting, formattingState } from '../../lib/formatting.mjs';

const tools = [
  ['B', 'Bold', 'bold'], ['I', 'Italic', 'italic'], ['U', 'Underline', 'underline'],
  ['S', 'Strikethrough', 'strike'], ['H2', 'Heading 2', 'h2'], ['H3', 'Heading 3', 'h3'],
  ['• List', 'Bulleted list', 'bullet'], ['1. List', 'Numbered list', 'number'],
  ['❝', 'Quote', 'quote'], ['Code', 'Inline code', 'code'], ['Link', 'Insert or remove link', 'link'], ['—', 'Divider', 'divider'], ['Tx', 'Clear formatting', 'clear']
];

export default function FormattingEditor({ value = '', onChange, placeholder = 'Write your content…', label = 'Text' }) {
  const id = useId();
  const textarea = useRef(null);
  const history = useRef({ past: [], future: [], lastTyping: 0 });
  const [range, setRange] = useState([0, 0]);
  const [preview, setPreview] = useState(false);
  const source = String(value || '');
  const lastCommitted = useRef(source);
  useEffect(() => { if (source !== lastCommitted.current) { history.current = {past:[],future:[],lastTyping:0}; lastCommitted.current=source; } },[source]);
  const active = formattingState(source, ...range);
  function rememberSelection() { const el = textarea.current; if (el) setRange([el.selectionStart, el.selectionEnd]); }
  function restore(start, end) { requestAnimationFrame(() => { textarea.current?.focus(); textarea.current?.setSelectionRange(start, end); setRange([start, end]); }); }
  function commit(next, typing = false) {
    if (next === source) return;
    const h = history.current;
    if (!typing || Date.now() - h.lastTyping > 650) h.past = [...h.past.slice(-49), { value: source, range }];
    h.lastTyping = typing ? Date.now() : 0; h.future = [];
    lastCommitted.current = next; onChange(next);
  }
  function format(tool) {
    let url = '';
    if (tool === 'link' && !active.link) { url = window.prompt('Link URL (https://, /page or #section)', 'https://') || ''; if (!url) return; }
    const next = applyFormatting(source, ...range, tool, url);
    setPreview(false); commit(next.value); restore(next.start, next.end);
  }
  function travel(direction) {
    const h = history.current, from = direction === 'undo' ? h.past : h.future, to = direction === 'undo' ? h.future : h.past;
    if (!from.length) return;
    const next = from.pop(); to.push({ value: source, range }); h.lastTyping = 0;
    setPreview(false); lastCommitted.current = next.value; onChange(next.value); restore(...next.range);
  }
  function keyDown(event) {
    if (!(event.ctrlKey || event.metaKey)) return;
    const key = event.key.toLowerCase();
    if (['b', 'i', 'u'].includes(key)) { event.preventDefault(); format({ b: 'bold', i: 'italic', u: 'underline' }[key]); }
    if (key === 'z' || key === 'y') { event.preventDefault(); travel(key === 'y' || event.shiftKey ? 'redo' : 'undo'); }
  }
  return <div className="field rich-field"><div className="field-label-row"><label htmlFor={id}>{label}</label><span className="small">Formatting toggles on and off</span></div>
    <div className="format-toolbar" role="toolbar" aria-label={`${label} formatting`}>
      {tools.map(([name, title, tool]) => <button key={tool} type="button" title={title} aria-label={title} aria-pressed={tool in active ? active[tool] : undefined} onPointerDown={e => e.preventDefault()} onClick={() => format(tool)}>{name}</button>)}
      <button type="button" aria-label="Undo formatting or typing" title="Undo (Ctrl/Cmd+Z)" disabled={!history.current.past.length} onPointerDown={e => e.preventDefault()} onClick={() => travel('undo')}>↶</button>
      <button type="button" aria-label="Redo formatting or typing" title="Redo (Ctrl/Cmd+Shift+Z)" disabled={!history.current.future.length} onPointerDown={e => e.preventDefault()} onClick={() => travel('redo')}>↷</button>
      <button type="button" onClick={() => setPreview(!preview)} aria-pressed={preview}>{preview ? 'Edit' : 'Preview'}</button>
    </div>
    <textarea id={id} ref={textarea} rows={7} style={preview ? { display: 'none' } : undefined} value={source} placeholder={placeholder} onSelect={rememberSelection} onKeyUp={rememberSelection} onClick={rememberSelection} onKeyDown={keyDown} onChange={e => { commit(e.target.value, true); setRange([e.target.selectionStart, e.target.selectionEnd]); }}/>
    {preview && <div className="format-preview" tabIndex={0} aria-label={`${label} formatted preview`}><FormattedText text={source}/></div>}
    <p className="small field-help">Select text, then click a style to apply or remove it. Ctrl/Cmd+B, I and U work too. Use Tx to clear formatting.</p>
  </div>;
}
