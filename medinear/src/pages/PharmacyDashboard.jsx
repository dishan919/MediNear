import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import api from '../api/api';
import Icon from '../components/Icon';
import InventoryTable from '../components/InventoryTable';
import MedicineEditor from '../components/MedicineEditor';
import { filterMedicines } from '../utils/medicineDisplay';
import '../styles/MedicineUI.css';
import '../styles/PharmacyDashboard.css';
const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const defaultHours = () => days.map((_, day) => ({ day, closed: false, allDay: false, open: '08:00', close: '20:00' }));
const blankProfile = { name: '', address: '', district: '', phone: '', latitude: '', longitude: '', image: '' };
const labels = { name: 'Pharmacy name', address: 'Address', district: 'District', phone: 'Phone number', latitude: 'Latitude', longitude: 'Longitude', image: 'Pharmacy image URL (optional)' };
export default function PharmacyDashboard() {
  const { user } = useAuth();
  const [pharmacies, setPharmacies] = useState([]), [selected, setSelected] = useState('');
  const [profile, setProfile] = useState(blankProfile), [hours, setHours] = useState(defaultHours), [timezone, setTimezone] = useState('Asia/Colombo');
  const [notice, setNotice] = useState(null), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [tab, setTab] = useState('inventory');
  const [editor, setEditor] = useState(null), [editorError, setEditorError] = useState(''), [query, setQuery] = useState('');
  const current = pharmacies.find(p => p._id === selected);
  const config = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
  async function load(id) {
    const { data } = await api.get('/pharmacies/mine', config());
    setPharmacies(data.pharmacies || []);
    setSelected(id ?? data.pharmacies?.[0]?._id ?? '');
    setLoading(false);
  }
  useEffect(() => { let active = true; api.get('/pharmacies/mine', config()).then(({ data }) => {
    if (active) { setPharmacies(data.pharmacies || []); setSelected(data.pharmacies?.[0]?._id || ''); }
  }).catch(e => { if (active) setNotice({ error: true, text: e.response?.data?.message || 'Unable to load pharmacies.' }); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  useEffect(() => {
    setProfile(current ? Object.fromEntries(Object.keys(blankProfile).map(key => [key, current[key] ?? ''])) : blankProfile);
    setHours(current?.openingHours?.length === 7 ? current.openingHours : defaultHours()); setTimezone(current?.timezone || 'Asia/Colombo');
  }, [current]);
  async function perform(action, success = 'Saved successfully.') {
    setBusy(true); setNotice(null);
    try { await action(); setNotice({ error: false, text: success }); return true; }
    catch (e) { setNotice({ error: true, text: e.response?.data?.message || 'Unable to save changes.' }); return false; }
    finally { setBusy(false); }
  }
  async function saveMedicine(body) {
    setBusy(true); setEditorError('');
    try {
      if (editor.medicine) await api.patch(`/pharmacies/${selected}/inventory/${editor.medicine._id}`, body, config());
      else await api.post(`/pharmacies/${selected}/inventory`, body, config());
      await load(selected); setEditor(null); setNotice({ error: false, text: 'Medicine saved. Customers can see the latest stock.' });
    } catch (e) { setEditorError(e.response?.data?.message || 'Unable to save medicine.'); }
    finally { setBusy(false); }
  }
  function edit(medicine) { setEditorError(''); setEditor({ medicine }); }
  function remove(medicine) {
    if (window.confirm(`Delete ${medicine.name} from this pharmacy?`)) perform(async () => { await api.delete(`/pharmacies/${selected}/inventory/${medicine._id}`, config()); await load(selected); }, 'Medicine deleted.');
  }
  const medicines = filterMedicines(current?.inventory || [], query);
  const availableCount = (current?.inventory || []).filter(m => m.quantity > 0).length;
  return <main className="mn-app mn-owner"><div className="mn-owner-inner"><header className="mn-owner-header"><div><p className="mn-eyebrow"><Icon name="cross" size={16} />MediNear · Pharmacy Owner Dashboard</p><h1>Your pharmacy, in good hands.</h1><p>Welcome, {user.fullName || user.name}. Keep your medicines and opening hours up to date.</p></div><span className="mn-owner-label"><Icon name="shield" size={17} />Owner workspace</span></header>
    {notice && <div className={`mn-notice ${notice.error ? 'mn-notice-error' : ''}`} role={notice.error ? 'alert' : 'status'}>{notice.text}{notice.error && !current && <button className="mn-text-button" onClick={() => perform(() => load())}>Try again</button>}</div>}
    <div className="mn-owner-selector"><label>Your pharmacy<select value={selected} disabled={busy || loading} onChange={e => { setSelected(e.target.value); setQuery(''); setNotice(null); if (!e.target.value) setTab('profile'); }}><option value="">Create a pharmacy</option>{pharmacies.map(p => <option value={p._id} key={p._id}>{p.name}</option>)}</select></label>{current && <p><Icon name="pin" size={17} />{current.address}</p>}</div>
    {loading ? <div className="mn-empty" role="status"><h2>Loading your workspace...</h2></div> : <>
      {current && <><div className="mn-owner-stats"><div><Icon name="pill" /><span>Total medicines<strong>{current.inventory?.length || 0}</strong></span></div><div><span className="mn-stat-dot mn-dot-green" /><span>Available<strong>{availableCount}</strong></span></div><div><span className="mn-stat-dot mn-dot-red" /><span>Out of stock<strong>{(current.inventory?.length || 0) - availableCount}</strong></span></div></div><nav className="mn-owner-tabs" aria-label="Pharmacy management sections">{[['inventory', 'Medicine Inventory'], ['profile', 'Pharmacy Profile'], ['hours', 'Opening Hours']].map(([key, title]) => <button className={tab === key ? 'mn-active' : ''} aria-pressed={tab === key} type="button" key={key} onClick={() => setTab(key)}>{title}</button>)}</nav></>}
      {current && tab === 'inventory' && <section className="mn-owner-panel"><div className="mn-section-header"><div><h2>Medicine Inventory</h2><p>Manage prices, stock and medicine information.</p></div><button className="mn-button mn-primary" disabled={busy} onClick={() => edit(null)}><Icon name="plus" size={18} />Add Medicine</button></div><label className="mn-local-search"><Icon name="search" size={18} /><span className="mn-sr-only">Search your inventory</span><input placeholder="Search medicines, generic names or brands..." type="search" value={query} onChange={e => setQuery(e.target.value)} /></label>{medicines.length ? <InventoryTable medicines={medicines} timezone={current.timezone} onEdit={edit} onDelete={remove} busy={busy} /> : <div className="mn-empty"><Icon name="pill" size={36} /><h3>{query ? 'No matching medicines' : 'Build your medicine inventory'}</h3><p>{query ? 'Try another name or brand.' : 'Add your first medicine so customers can find it.'}</p>{!query && <button className="mn-button mn-primary" onClick={() => edit(null)}>Add Medicine</button>}</div>}</section>}
      {(!current || tab === 'profile') && <section className="mn-owner-panel"><div className="mn-section-header"><div><h2>{current ? 'Pharmacy Profile' : 'Create your pharmacy'}</h2><p>Add the details customers use to reach your pharmacy.</p></div></div><form onSubmit={e => { e.preventDefault(); perform(async () => { const body = { ...profile, latitude: Number(profile.latitude), longitude: Number(profile.longitude) }; const response = selected ? await api.put(`/pharmacies/${selected}`, body, config()) : await api.post('/pharmacies', body, config()); await load(response.data.pharmacy._id); setTab('inventory'); }); }}><fieldset disabled={busy} className="mn-form-grid">{Object.keys(blankProfile).map(field => <label key={field}>{labels[field]}{field !== 'image' ? ' *' : ''}<input required={field !== 'image'} type={['latitude', 'longitude'].includes(field) ? 'number' : field === 'image' ? 'url' : 'text'} step="any" value={profile[field]} onChange={e => setProfile({ ...profile, [field]: e.target.value })} /></label>)}<div className="mn-full-field"><button className="mn-button mn-primary">{busy ? 'Saving...' : 'Save pharmacy'}</button></div></fieldset></form></section>}
      {current && tab === 'hours' && <section className="mn-owner-panel"><div className="mn-section-header"><div><h2>Opening Hours</h2><p>Set a weekly schedule. Earlier closing times mean an overnight shift.</p></div></div><form onSubmit={e => { e.preventDefault(); perform(async () => { await api.put(`/pharmacies/${selected}/hours`, { openingHours: hours, timezone }, config()); await load(selected); }); }}><fieldset disabled={busy}><label className="mn-timezone-field">Timezone<input required value={timezone} onChange={e => setTimezone(e.target.value)} /></label>{hours.map((h, index) => <div className="mn-hours-row" key={h.day}><strong>{days[h.day]}</strong>{['closed', 'allDay'].map(field => <label className="mn-hours-toggle" key={field}><input type="checkbox" checked={h[field]} onChange={e => setHours(hours.map((item, i) => i === index ? { ...item, [field]: e.target.checked, ...(e.target.checked ? { [field === 'closed' ? 'allDay' : 'closed']: false } : {}) } : item))} />{field === 'closed' ? 'Closed' : 'All day'}</label>)}{!h.closed && !h.allDay && ['open', 'close'].map(field => <label key={field}>{field === 'open' ? 'Opens' : 'Closes'}<input type="time" required value={h[field] || ''} onChange={e => setHours(hours.map((item, i) => i === index ? { ...item, [field]: e.target.value } : item))} /></label>)}</div>)}<button className="mn-button mn-primary">Save opening hours</button></fieldset></form></section>}
    </>}
    {editor && <MedicineEditor key={editor.medicine?._id || 'new'} medicine={editor.medicine} onSave={saveMedicine} onClose={() => setEditor(null)} busy={busy} error={editorError} />}
  </div></main>;
}
