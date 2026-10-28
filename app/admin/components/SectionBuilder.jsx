'use client';
import { useState } from 'react';
import MediaPicker from './MediaPicker';
import FormattingEditor from './FormattingEditor';

const defaults = {
  faq: { type: 'faq', kicker: 'Common questions', title: 'Frequently asked questions', items: [{ question: '', answer: '' }] },
  team: { type: 'team', kicker: 'Our people', title: 'Meet the team', items: [{ name: '', role: '', qualifications: '', text: '', image: '', linkedin: '' }] },
  text: { type: 'text', kicker: '', title: 'New Text Section', text: '' },
  stats: { type: 'stats', items: [{ value: '100+', label: 'Stat label' }] },
  split: { type: 'split', kicker: '', title: 'Split Section', text: '', buttonText: '', buttonUrl: '', cards: [{ title: 'Card title', text: 'Card text' }] },
  brand: { type: 'brand', logo: '', title: 'Brand Section', text: '' },
  cards: { type: 'cards', kicker: '', title: 'Cards Section', items: [{ id: '', title: 'Card title', text: 'Card text', url: '' }] },
  process: { type: 'process', kicker: '', title: 'Our Process', items: [{ title: 'Step 1', text: 'Describe this step.' }] },
  cta: { type: 'cta', title: 'Ready to get started?', text: '', buttonText: 'Contact Us', buttonUrl: '/contact' },
  contact: { type: 'contact', kicker: 'Contact Details', title: 'Reach our team', text: 'Share your requirement and our team will get back to you.' }
};

export function newSection(type) {
  return structuredClone(defaults[type] || defaults.text);
}

function TextField({ label, value, onChange, placeholder = '', textarea = false }) {
  return <div className="field"><label>{label}</label>{textarea
    ? <FormattingEditor label={label} value={value || ''} placeholder={placeholder} onChange={onChange} />
    : <input value={value || ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />}</div>;
}

function ListEditor({ items = [], fields, onChange, onAdd, addLabel = '+ Add Item' }) {
  function updateItem(index, key, value) {
    onChange(items.map((item, i) => i === index ? { ...item, [key]: value } : item));
  }
  function removeItem(index) { onChange(items.filter((_, i) => i !== index)); }
  function move(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items]; [next[index], next[target]] = [next[target], next[index]]; onChange(next);
  }
  return <div className="builder-list">
    {items.map((item, index) => <div className="builder-item" key={index}>
      <div className="builder-item-head"><strong>Item {index + 1}</strong><div className="admin-actions compact"><button type="button" className="icon-btn" onClick={() => move(index, -1)} disabled={index === 0}>↑</button><button type="button" className="icon-btn" onClick={() => move(index, 1)} disabled={index === items.length - 1}>↓</button><button type="button" className="icon-btn danger-text" onClick={() => removeItem(index)}>×</button></div></div>
      <div className="admin-grid">
        {fields.map((field) => <TextField key={field.key} label={field.label} value={item[field.key]} textarea={field.textarea} placeholder={field.placeholder} onChange={(value) => updateItem(index, field.key, value)} />)}
      </div>
    </div>)}
    <button type="button" className="admin-btn light" onClick={onAdd}>{addLabel}</button>
  </div>;
}

export default function SectionBuilder({ sections = [], onChange, media = [], onUploadMedia }) {
  const [dragIndex, setDragIndex] = useState(null);
  const [sectionType, setSectionType] = useState('text');

  function patch(index, values) { onChange(sections.map((section, i) => i === index ? { ...section, ...values } : section)); }
  function add(type) { onChange([...sections, newSection(type)]); }
  function remove(index) { if (confirm('Delete this section?')) onChange(sections.filter((_, i) => i !== index)); }
  function duplicate(index) { const next = [...sections]; next.splice(index + 1, 0, structuredClone(sections[index])); onChange(next); }
  function move(index, direction) { const target = index + direction; if (target < 0 || target >= sections.length) return; const next = [...sections]; [next[index], next[target]] = [next[target], next[index]]; onChange(next); }
  function dropAt(targetIndex) {
    if (dragIndex === null || dragIndex === targetIndex) { setDragIndex(null); return; }
    const next = [...sections];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, moved);
    onChange(next); setDragIndex(null);
  }

  return <div className="section-builder">
    <div className="builder-toolbar">
      <div><h3>Page Sections</h3><p className="small">Add sections, drag them into position, then edit the content. No JSON required.</p></div>
      <div className="add-section-menu">
        <select value={sectionType} onChange={(e) => setSectionType(e.target.value)}>
          <option value="text">Text</option><option value="faq">FAQs</option><option value="team">Team / Partner Profiles</option><option value="stats">Stats</option><option value="split">Split + Feature Cards</option><option value="brand">Brand / Logo</option><option value="cards">Service Cards</option><option value="process">Process Steps</option><option value="cta">Call To Action</option><option value="contact">Contact Form</option>
        </select>
        <button type="button" className="admin-btn" onClick={() => add(sectionType)}>+ Add Section</button>
      </div>
    </div>

    {sections.length === 0 && <div className="empty-state">No sections yet. Add your first section above.</div>}

    {sections.map((section, index) => <details className={`section-editor ${dragIndex === index ? 'dragging' : ''}`} key={index} open draggable onDragStart={(e) => { setDragIndex(index); e.dataTransfer.effectAllowed = 'move'; }} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }} onDrop={(e) => { e.preventDefault(); dropAt(index); }} onDragEnd={() => setDragIndex(null)}>
      <summary><div><span className="drag-mark" title="Drag to reorder">⋮⋮</span><strong>{index + 1}. {section.type?.toUpperCase() || 'SECTION'}</strong>{section.title && <span className="section-summary-title">{section.title}</span>}</div><span className="small">Drag or click to edit</span></summary>
      <div className="section-editor-body">
        <div className="section-editor-actions"><button type="button" className="admin-btn light" onClick={() => move(index, -1)} disabled={index === 0}>↑ Up</button><button type="button" className="admin-btn light" onClick={() => move(index, 1)} disabled={index === sections.length - 1}>↓ Down</button><button type="button" className="admin-btn light" onClick={() => duplicate(index)}>Duplicate</button><button type="button" className="admin-btn danger" onClick={() => remove(index)}>Delete</button></div>

        {['faq', 'team'].includes(section.type) && <><div className="admin-grid"><TextField label="Kicker" value={section.kicker} onChange={v => patch(index, {kicker:v})}/><TextField label="Heading" value={section.title} onChange={v => patch(index, {title:v})}/></div><ListEditor items={section.items || []} fields={section.type === 'faq' ? [{key:'question',label:'Question'}, {key:'answer',label:'Answer',textarea:true}] : [{key:'name',label:'Name'}, {key:'role',label:'Role'}, {key:'qualifications',label:'Verified qualifications'}, {key:'image',label:'Photo URL (copy from Media)'}, {key:'linkedin',label:'LinkedIn URL'}, {key:'text',label:'Profile',textarea:true}]} onChange={items => patch(index,{items})} onAdd={() => patch(index, {items:[...(section.items || []), section.type === 'faq' ? {question:'',answer:''} : {name:'',role:'',text:'',image:''}]})} addLabel={section.type === 'faq' ? '+ Add Question' : '+ Add Person'}/>{section.type === 'team' && <p className="small">Use approved names, qualifications and photographs. Empty example profiles are not published automatically.</p>}</>}
        {section.type === 'text' && <><div className="admin-grid"><TextField label="Kicker" value={section.kicker} onChange={(v) => patch(index, { kicker: v })} /><TextField label="Heading" value={section.title} onChange={(v) => patch(index, { title: v })} /></div><TextField label="Text" textarea value={section.text} onChange={(v) => patch(index, { text: v })} /></>}
        {section.type === 'stats' && <ListEditor items={section.items || []} fields={[{ key: 'value', label: 'Value' }, { key: 'label', label: 'Label' }]} onChange={(items) => patch(index, { items })} onAdd={() => patch(index, { items: [...(section.items || []), { value: '', label: '' }] })} addLabel="+ Add Stat" />}
        {section.type === 'split' && <><div className="admin-grid"><TextField label="Kicker" value={section.kicker} onChange={(v) => patch(index, { kicker: v })} /><TextField label="Heading" value={section.title} onChange={(v) => patch(index, { title: v })} /></div><TextField label="Text" textarea value={section.text} onChange={(v) => patch(index, { text: v })} /><div className="admin-grid"><TextField label="Button Text" value={section.buttonText} onChange={(v) => patch(index, { buttonText: v })} /><TextField label="Button URL" value={section.buttonUrl} onChange={(v) => patch(index, { buttonUrl: v })} /></div><h4>Feature Cards</h4><ListEditor items={section.cards || []} fields={[{ key: 'title', label: 'Title' }, { key: 'text', label: 'Text', textarea: true }]} onChange={(cards) => patch(index, { cards })} onAdd={() => patch(index, { cards: [...(section.cards || []), { title: '', text: '' }] })} addLabel="+ Add Feature Card" /></>}
        {section.type === 'brand' && <><div className="admin-grid"><TextField label="Heading" value={section.title} onChange={(v) => patch(index, { title: v })} /><MediaPicker label="Logo / Image" value={section.logo} onChange={(v) => patch(index, { logo: v })} media={media} onUpload={onUploadMedia} /></div><TextField label="Text" textarea value={section.text} onChange={(v) => patch(index, { text: v })} /></>}
        {section.type === 'cards' && <><div className="admin-grid"><TextField label="Kicker" value={section.kicker} onChange={(v) => patch(index, { kicker: v })} /><TextField label="Heading" value={section.title} onChange={(v) => patch(index, { title: v })} /></div><ListEditor items={section.items || []} fields={[{ key: 'id', label: 'Anchor ID', placeholder: 'optional-anchor' }, { key: 'title', label: 'Title' }, { key: 'text', label: 'Text', textarea: true }, { key: 'url', label: 'Link URL', placeholder: 'Optional' }, {key:'linkText',label:'Link label',placeholder:'Explore service'}]} onChange={(items) => patch(index, { items })} onAdd={() => patch(index, { items: [...(section.items || []), { id: '', title: '', text: '', url: '' }] })} addLabel="+ Add Card" /></>}
        {section.type === 'process' && <><div className="admin-grid"><TextField label="Kicker" value={section.kicker} onChange={(v) => patch(index, { kicker: v })} /><TextField label="Heading" value={section.title} onChange={(v) => patch(index, { title: v })} /></div><ListEditor items={section.items || []} fields={[{ key: 'title', label: 'Step Title' }, { key: 'text', label: 'Step Text', textarea: true }]} onChange={(items) => patch(index, { items })} onAdd={() => patch(index, { items: [...(section.items || []), { title: `Step ${(section.items || []).length + 1}`, text: '' }] })} addLabel="+ Add Step" /></>}
        {section.type === 'cta' && <><TextField label="Heading" value={section.title} onChange={(v) => patch(index, { title: v })} /><TextField label="Text" textarea value={section.text} onChange={(v) => patch(index, { text: v })} /><div className="admin-grid"><TextField label="Button Text" value={section.buttonText} onChange={(v) => patch(index, { buttonText: v })} /><TextField label="Button URL" value={section.buttonUrl} onChange={(v) => patch(index, { buttonUrl: v })} /></div></>}
        {section.type === 'contact' && <><div className="admin-grid"><TextField label="Kicker" value={section.kicker} onChange={(v) => patch(index, { kicker: v })} /><TextField label="Heading" value={section.title} onChange={(v) => patch(index, { title: v })} /></div><TextField label="Intro Text" textarea value={section.text} onChange={(v) => patch(index, { text: v })} /><p className="small">Phone, email and address are pulled from Site Settings automatically.</p></>}
      </div>
    </details>)}
  </div>;
}
