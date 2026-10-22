'use client';
import { useMemo, useState } from 'react';

function isImage(url = '') {
  return /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(url) || url.includes('blob.vercel-storage.com');
}

export default function MediaPicker({ media = [], value = '', onChange, onUpload, label = 'Image', help = '' }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return media.filter((item) => isImage(item.url || '') && (!q || `${item.name} ${item.url}`.toLowerCase().includes(q)));
  }, [media, query]);

  return <div className="field media-picker-field">
    <label>{label}</label>
    <div className="media-input-row">
      <input value={value || ''} placeholder="Choose from Media or paste image URL" onChange={(e) => onChange(e.target.value)} />
      <button type="button" className="admin-btn light" onClick={() => setOpen(true)}>Choose Media</button>
    </div>
    {help && <p className="small field-help">{help}</p>}
    {value && <div className="selected-media-preview"><img src={value} alt="Selected" /><button type="button" className="icon-btn danger-text" title="Remove image" onClick={() => onChange('')}>×</button></div>}

    {open && <div className="admin-modal-backdrop" onMouseDown={() => setOpen(false)}>
      <div className="admin-modal media-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="admin-modal-head"><div><h3>Select Image</h3><p className="small">Choose an uploaded image or upload a new one.</p></div><button type="button" className="icon-btn" onClick={() => setOpen(false)}>×</button></div>
        <div className="media-modal-tools">
          <input placeholder="Search media..." value={query} onChange={(e) => setQuery(e.target.value)} />
          {onUpload && <label className="admin-btn file-button">+ Upload Image<input type="file" accept="image/*" onChange={async (event) => { await onUpload(event); }} /></label>}
        </div>
        <div className="picker-grid">
          {filtered.map((item) => <button type="button" className={`picker-card ${value === item.url ? 'selected' : ''}`} key={item.id} onClick={() => { onChange(item.url); setOpen(false); }}>
            <img src={item.url} alt={item.alt || item.name || ''} />
            <span title={item.name}>{item.name}</span>
          </button>)}
        </div>
        {filtered.length === 0 && <div className="empty-state">No images found. Upload an image or paste a URL directly.</div>}
      </div>
    </div>}
  </div>;
}
