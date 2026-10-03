import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import api from '../api/api';
import '../styles/PharmacyDashboard.css';
const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const defaultHours = () => days.map((_, day) => ({ day, closed: false, allDay: false, open: '08:00', close: '20:00' }));
const blankMedicine = { name: '', genericName: '', brand: '', quantity: 0, price: '' };
const blankProfile = { name: '', address: '', district: '', phone: '', latitude: '', longitude: '' };
export default function PharmacyDashboard() {
  const { user } = useAuth();
  const [pharmacies, setPharmacies] = useState([]);
  const [selected, setSelected] = useState('');
  const [profile, setProfile] = useState(blankProfile);
  const [medicine, setMedicine] = useState(blankMedicine);
  const [editing, setEditing] = useState('');
  const [hours, setHours] = useState(defaultHours);
  const [timezone, setTimezone] = useState('Asia/Colombo');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const current = pharmacies.find(p => p._id === selected);
  const config = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
  async function load(id) {
    const { data } = await api.get('/pharmacies/mine', config());
    setPharmacies(data.pharmacies);
    if (id !== undefined) setSelected(id);
  }
  useEffect(() => { load().catch(e => setMessage(e.response?.data?.message || 'Unable to load pharmacies')); }, []);
  useEffect(() => {
    setProfile(current ? Object.fromEntries(Object.keys(blankProfile).map(k => [k, current[k]])) : blankProfile);
    setHours(current?.openingHours?.length === 7 ? current.openingHours : defaultHours());
    setTimezone(current?.timezone || 'Asia/Colombo');
    setMedicine(blankMedicine); setEditing('');
  }, [current]);
  async function perform(action) {
    setBusy(true); setMessage('');
    try { await action(); setMessage('Saved successfully.'); }
    catch (e) { setMessage(e.response?.data?.message || 'Unable to save changes'); }
    finally { setBusy(false); }
  }
  const base = `/pharmacies/${selected}`;
  return <main className="owner-dashboard">
    <header><p className="owner-dashboard-label">Pharmacy Owner Dashboard</p><h1>Welcome, {user.fullName || user.name}</h1><p>Manage your pharmacy, opening hours and medicine stock.</p></header>
    <p role="status">{message}</p>
    <label>Choose pharmacy <select value={selected} onChange={e => setSelected(e.target.value)} disabled={busy}><option value="">Create a pharmacy</option>{pharmacies.map(p => <option value={p._id} key={p._id}>{p.name}</option>)}</select></label>
    <section className="owner-dashboard-card">
      <h2>Pharmacy profile</h2>
      <form onSubmit={e => { e.preventDefault(); perform(async () => {
        const body = { ...profile, latitude: Number(profile.latitude), longitude: Number(profile.longitude) };
        const response = selected ? await api.put(base, body, config()) : await api.post('/pharmacies', body, config());
        await load(response.data.pharmacy._id);
      }); }}>
        <fieldset disabled={busy} className="owner-fields">{Object.keys(blankProfile).map(field => <label key={field}>{field}<input required type={['latitude', 'longitude'].includes(field) ? 'number' : 'text'} step="any" value={profile[field]} onChange={e => setProfile({ ...profile, [field]: e.target.value })} /></label>)}<button>Save pharmacy</button></fieldset>
      </form>
    </section>
    {current && <>
      <section className="owner-dashboard-card"><h2>Opening hours</h2><p>Sunday to Saturday. Closing earlier than opening means an overnight shift. Select All day for a full 24-hour day.</p>
        <form onSubmit={e => { e.preventDefault(); perform(async () => { await api.put(`${base}/hours`, { openingHours: hours, timezone }, config()); await load(selected); }); }}>
          <fieldset disabled={busy}><label>Timezone <input required value={timezone} onChange={e => setTimezone(e.target.value)} /></label>
            {hours.map((h, index) => <div className="hours-row" key={h.day}><strong>{days[h.day]}</strong>{['closed', 'allDay'].map(field => <label key={field}><input type="checkbox" checked={h[field]} onChange={e => setHours(hours.map((item, i) => i === index ? { ...item, [field]: e.target.checked, ...(e.target.checked ? { [field === 'closed' ? 'allDay' : 'closed']: false } : {}) } : item))} />{field === 'closed' ? 'Closed' : 'All day'}</label>)}{!h.closed && !h.allDay && ['open', 'close'].map(field => <label key={field}>{field}<input type="time" required value={h[field] || ''} onChange={e => setHours(hours.map((item, i) => i === index ? { ...item, [field]: e.target.value } : item))} /></label>)}</div>)}
            <button>Save opening hours</button>
          </fieldset>
        </form>
      </section>
      <section className="owner-dashboard-card"><h2>Medicine inventory</h2>
        <form onSubmit={e => { e.preventDefault(); perform(async () => {
          const body = { ...medicine, quantity: Number(medicine.quantity), price: medicine.price === '' ? null : Number(medicine.price) };
          if (editing) await api.patch(`${base}/inventory/${editing}`, body, config()); else await api.post(`${base}/inventory`, body, config());
          await load(selected);
        }); }}><fieldset disabled={busy} className="owner-fields">{Object.keys(blankMedicine).map(field => <label key={field}>{field}{field === 'price' ? ' (LKR, optional)' : ''}<input required={['name', 'quantity'].includes(field)} type={['quantity', 'price'].includes(field) ? 'number' : 'text'} min="0" step={field === 'quantity' ? '1' : 'any'} maxLength="120" value={medicine[field]} onChange={e => setMedicine({ ...medicine, [field]: e.target.value })} /></label>)}<button>{editing ? 'Save medicine' : 'Add medicine'}</button><button type="button" onClick={() => { setEditing(''); setMedicine(blankMedicine); }}>Clear</button></fieldset></form>
        <div className="inventory-list">{current.inventory.map(m => <article key={m._id}><h3>{m.name}</h3><p>{m.genericName} {m.brand}</p><p>Quantity: {m.quantity} · {m.quantity > 0 ? 'Available' : 'Out of Stock'}{m.price !== undefined ? ` · LKR ${m.price}` : ''}</p><p>Updated: {new Date(m.updatedAt).toLocaleString()}</p><button disabled={busy} onClick={() => { setEditing(m._id); setMedicine({ ...blankMedicine, ...m }); }}>Edit / quantity</button><button disabled={busy || m.quantity === 0} onClick={() => perform(async () => { await api.patch(`${base}/inventory/${m._id}`, { quantity: 0 }, config()); await load(selected); })}>Mark out of stock</button><button disabled={busy} onClick={() => { if (window.confirm(`Delete ${m.name}?`)) perform(async () => { await api.delete(`${base}/inventory/${m._id}`, config()); await load(selected); }); }}>Delete</button></article>)}</div>
        {!current.inventory.length && <p>No medicines yet. Add your first medicine above.</p>}
      </section>
    </>}
  </main>;
}
