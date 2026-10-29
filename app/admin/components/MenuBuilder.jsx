'use client';

function ItemFields({ item, onPatch, onDelete, onMoveUp, onMoveDown, first, last, childrenMode = false }) {
  return <div className={`menu-builder-item ${childrenMode ? 'child' : ''}`}>
    <div className="menu-builder-row">
      <span className="drag-mark">⋮⋮</span>
      <input aria-label="Menu label" placeholder="Label" value={item.label || ''} onChange={(e) => onPatch({ label: e.target.value })} />
      <input aria-label="Menu URL" placeholder="/page-or-url" value={item.url || ''} onChange={(e) => onPatch({ url: e.target.value })} />
      <button type="button" className="icon-btn" disabled={first} onClick={onMoveUp}>↑</button>
      <button type="button" className="icon-btn" disabled={last} onClick={onMoveDown}>↓</button>
      <button type="button" className="icon-btn danger-text" onClick={onDelete}>×</button>
    </div>
  </div>;
}

export default function MenuBuilder({ title, items = [], onChange, allowChildren = false }) {
  function patch(index, values) { onChange(items.map((item, i) => i === index ? { ...item, ...values } : item)); }
  function remove(index) { onChange(items.filter((_, i) => i !== index)); }
  function move(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }
  function add() { onChange([...items, { label: 'New Link', url: '/', ...(allowChildren ? { children: [] } : {}) }]); }
  function childPatch(parentIndex, childIndex, values) {
    const children = [...(items[parentIndex].children || [])];
    children[childIndex] = { ...children[childIndex], ...values };
    patch(parentIndex, { children });
  }
  function childRemove(parentIndex, childIndex) {
    patch(parentIndex, { children: (items[parentIndex].children || []).filter((_, i) => i !== childIndex) });
  }
  function childMove(parentIndex, childIndex, direction) {
    const children = [...(items[parentIndex].children || [])];
    const target = childIndex + direction;
    if (target < 0 || target >= children.length) return;
    [children[childIndex], children[target]] = [children[target], children[childIndex]];
    patch(parentIndex, { children });
  }
  function addChild(parentIndex) { patch(parentIndex, { children: [...(items[parentIndex].children || []), { label: 'Dropdown Link', url: '/' }] }); }

  return <div className="menu-builder"><div className="builder-toolbar"><div><h3>{title}</h3><p className="small">Change labels, URLs and order visually.</p></div><button type="button" className="admin-btn" onClick={add}>+ Add Link</button></div>
    {items.map((item, index) => <div className="menu-parent" key={index}>
      <ItemFields item={item} onPatch={(v) => patch(index, v)} onDelete={() => remove(index)} onMoveUp={() => move(index, -1)} onMoveDown={() => move(index, 1)} first={index === 0} last={index === items.length - 1} />
      {allowChildren && <div className="menu-children">
        {(item.children || []).map((child, childIndex) => <ItemFields key={childIndex} childrenMode item={child} onPatch={(v) => childPatch(index, childIndex, v)} onDelete={() => childRemove(index, childIndex)} onMoveUp={() => childMove(index, childIndex, -1)} onMoveDown={() => childMove(index, childIndex, 1)} first={childIndex === 0} last={childIndex === (item.children || []).length - 1} />)}
        <button type="button" className="admin-btn light mini" onClick={() => addChild(index)}>+ Add Dropdown Item</button>
      </div>}
    </div>)}
  </div>;
}
