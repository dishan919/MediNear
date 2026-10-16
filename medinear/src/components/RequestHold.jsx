import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getUserRole } from '../auth/roles';
import { useToast } from '../auth/ToastContext';
import api from '../api/api';
import { createHoldRunner, holdService, holdToast, holdError, quantityError } from '../utils/holds';
import '../styles/Holds.css';
export function HoldForm({ id, medicineName, quantity, stock, busy, error, onChange, onSubmit, onCancel }) {
  return <form className="mn-hold-form" onSubmit={onSubmit} noValidate aria-busy={busy}>
    <label htmlFor={id}>{`Quantity to request for ${medicineName}`}</label><input id={id} type="number" min="1" max={stock} step="1" value={quantity} onChange={onChange} disabled={busy} aria-invalid={!!error} aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`} />
    <p id={`${id}-help`}>A request is pending until the pharmacy confirms it. No price guarantee.</p>
    {error && <p id={`${id}-error`} role="alert" className="mn-inline-error">{error}</p>}
    <div className="mn-hold-actions"><button type="submit" className="mn-button mn-primary" disabled={busy}>{busy ? 'Sending...' : 'Send Hold Request'}</button><button type="button" className="mn-button mn-secondary" disabled={busy} onClick={onCancel}>Cancel</button></div>
  </form>;
}
function RequestHoldSession({ pharmacyId, medicine }) {
  const id = useId(), { showToast } = useToast();
  const [runner] = useState(createHoldRunner), [service] = useState(() => holdService(api, () => localStorage.getItem('token')));
  const [open, setOpen] = useState(false), [quantity, setQuantity] = useState('1'), [busy, setBusy] = useState(false), [error, setError] = useState(''), [sent, setSent] = useState(false);
  useEffect(() => () => runner.dispose(), [runner]);
  function submit(event) {
    event.preventDefault(); const problem = quantityError(quantity, medicine.quantity); setError(problem); if (problem) return;
    runner.run(signal => service.create(pharmacyId, medicine._id, Number(quantity), signal), { busy: setBusy, success() { setSent(true); setOpen(false); showToast(holdToast('create')); }, error(e) { setError(holdError(e)); } });
  }
  if (sent) return <div className="mn-hold-feedback" role="status"><p>Pending: Waiting for pharmacy confirmation.</p><Link to="/profile#my-hold-requests">My Hold Requests</Link></div>;
  return open ? <HoldForm id={id} medicineName={medicine.name} quantity={quantity} stock={medicine.quantity} busy={busy} error={error} onChange={event => { setQuantity(event.target.value); setError(''); }} onSubmit={submit} onCancel={() => { setOpen(false); setError(''); }} /> : <button type="button" className="mn-button mn-secondary" onClick={() => setOpen(true)} aria-label={`Request hold for ${medicine.name}`}>Request Hold</button>;
}
export default function RequestHold({ pharmacyId, medicine }) {
  const { user } = useAuth() || {};
  if (!user || getUserRole(user) !== 'customer' || !pharmacyId || !medicine?._id || !Number.isSafeInteger(medicine.quantity) || medicine.quantity <= 0) return null;
  return <RequestHoldSession key={`${pharmacyId}:${medicine._id}:${user.id || user._id}`} pharmacyId={pharmacyId} medicine={medicine} />;
}
