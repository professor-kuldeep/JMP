'use client';
import { useRef, useState } from 'react';
import FormattedText from '../../components/FormattedText';

const tools = [
  ['B', 'Bold', '**', '**'], ['I', 'Italic', '*', '*'], ['U', 'Underline', '++', '++'],
  ['S', 'Strikethrough', '~~', '~~'], ['H2', 'Heading 2', '## ', ''], ['H3', 'Heading 3', '### ', ''],
  ['• List', 'Bulleted list', '- ', ''], ['1. List', 'Numbered list', '1. ', ''],
  ['❝', 'Quote', '> ', ''], ['Code', 'Inline code', '`', '`'],
  ['Link', 'Insert link', '[', '](https://example.com)'], ['—', 'Divider', '\n---\n', '']
];
export default function FormattingEditor({ value = '', onChange, placeholder = 'Write your content...', label = 'Text' }) {
  const textarea = useRef(null);
  const [preview, setPreview] = useState(false);
  function format(before, after) {
    const el = textarea.current;
    if (!el) return;
    const start = el.selectionStart, end = el.selectionEnd;
    const source = String(value || '');
    const selection = source.slice(start, end);
    const result = source.slice(0,start) + before + (selection || (before === '[' ? 'link text' : 'text')) + after + source.slice(end);
    onChange(result);
    requestAnimationFrame(()=>{el.focus(); el.setSelectionRange(start + before.length, start + before.length + (selection || (before === '[' ? 'link text' : 'text')).length);});
  }
  return <div className="field rich-field"><div className="field-label-row"><label>{label}</label><span className="small">Rich text for all pages & blogs</span></div>
    <div className="format-toolbar" role="toolbar" aria-label={`${label} formatting`}>
      {tools.map(([name,title,before,after]) => <button key={title} type="button" title={title} aria-label={title} onClick={()=>{setPreview(false);format(before,after);}}>{name}</button>)}
      <button type="button" onClick={()=>setPreview(!preview)} aria-pressed={preview}>{preview ? 'Edit' : 'Preview'}</button>
    </div>
    {preview ? <div className="format-preview"><FormattedText text={value}/></div> : <textarea ref={textarea} rows={6} value={value || ''} placeholder={placeholder} onChange={e=>onChange(e.target.value)} />}
    <p className="small field-help">Select text and click a formatting button. Content is saved with the page.</p>
  </div>;
}
