import { useEffect, useRef, useState } from 'react';
import AssetImage from './AssetImage';
import Icon from './Icon';
export default function MedicineEditor({ medicine, onSave, onClose, busy, error }) {
  const dialog = useRef(null);
  const [draft, setDraft] = useState({ name: medicine?.name || '', genericName: medicine?.genericName || '', brand: medicine?.brand || '', imageUrl: medicine?.imageUrl || '', quantity: medicine?.quantity ?? 0, price: medicine?.price ?? '' });
  useEffect(() => { dialog.current.showModal(); }, []);
  const field = (name, value) => setDraft(previous => ({ ...previous, [name]: value }));
  return <dialog className="mn-medicine-dialog" ref={dialog} aria-labelledby="medicine-editor-title" onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}>
    <div className="mn-dialog-header"><div><p className="mn-eyebrow">Medicine inventory</p><h2 id="medicine-editor-title">{medicine ? 'Edit Medicine' : 'Add Medicine'}</h2></div><button type="button" className="mn-button mn-icon-button" aria-label="Close medicine form" disabled={busy} onClick={onClose}><Icon name="close" /></button></div>
    <p className="mn-muted">Add the details customers need to find this medicine.</p>
    <form onSubmit={e => { e.preventDefault(); onSave({ name: draft.name, genericName: draft.genericName, brand: draft.brand, imageUrl: draft.imageUrl, quantity: Number(draft.quantity), price: Number(draft.price) }); }}>
      <fieldset disabled={busy}><div className="mn-image-field"><AssetImage src={draft.imageUrl} alt="Medicine image preview" className="mn-editor-image" /><label>Medicine image URL<input type="url" placeholder="https://..." value={draft.imageUrl} onChange={e => field('imageUrl', e.target.value)} maxLength={2048} /><span className="mn-field-help">Use an HTTPS image link. Leave blank for the medicine placeholder.</span></label></div>
        <div className="mn-form-grid"><label className="mn-full-field">Medicine Name *<input autoFocus required maxLength={120} value={draft.name} onChange={e => field('name', e.target.value)} /></label><label>Generic Name<input maxLength={120} value={draft.genericName} onChange={e => field('genericName', e.target.value)} /></label><label>Brand<input maxLength={120} value={draft.brand} onChange={e => field('brand', e.target.value)} /></label><label>Price (LKR) *<input type="number" min="0" step="0.01" required value={draft.price} onChange={e => field('price', e.target.value)} /></label><label>Quantity / Stock *<input type="number" min="0" step="1" required value={draft.quantity} onChange={e => field('quantity', e.target.value)} /></label></div>
        <div className="mn-editor-availability"><span className={`mn-badge ${Number(draft.quantity) > 0 ? 'mn-positive' : 'mn-negative'}`}>{Number(draft.quantity) > 0 ? 'Available' : 'Out of Stock'}</span><p>Status updates automatically from stock quantity.</p></div>
        {error && <p role="alert" className="mn-form-error">{error}</p>}
        <div className="mn-dialog-footer"><button type="button" className="mn-button mn-secondary" onClick={onClose}>Cancel</button><button type="submit" className="mn-button mn-primary">{busy ? 'Saving...' : medicine ? 'Save Changes' : 'Add Medicine'}</button></div>
      </fieldset>
    </form>
  </dialog>;
}
