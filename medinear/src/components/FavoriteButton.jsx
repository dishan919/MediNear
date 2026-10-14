import { useEffect, useRef, useState } from 'react';
import api from '../api/api';
import { favoritesService } from '../api/favorites';
import Icon from './Icon';
export default function FavoriteButton({ pharmacyId, initiallyFavorite = false, onChange, showLabel = false, disabled = false }) {
  const [favorite, setFavorite] = useState(initiallyFavorite), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const pending = useRef(false);
  useEffect(() => { setFavorite(initiallyFavorite); }, [initiallyFavorite]);
  async function toggle() {
    if (pending.current || disabled) return;
    pending.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const result = await favoritesService(api, localStorage).setSaved(pharmacyId, !favorite);
      setFavorite(result.saved); setMessage(result.message); onChange?.(pharmacyId, result.saved);
    } catch (e) { setError(e.response?.data?.message || 'Unable to update saved pharmacy.'); }
    finally { pending.current = false; setBusy(false); }
  }
  return <div className="mn-favorite"><button type="button" className={`mn-button ${showLabel ? 'mn-secondary' : 'mn-icon-button'} ${favorite ? 'mn-saved' : ''}`} aria-label={favorite ? 'Remove from saved pharmacies' : 'Save Pharmacy'} aria-pressed={favorite} aria-busy={busy} disabled={busy || disabled} onClick={toggle}><Icon name="heart" fill={favorite ? 'currentColor' : 'none'} />{showLabel && (busy ? 'Updating...' : favorite ? 'Saved' : 'Save Pharmacy')}</button>{message && <p role="status" className="mn-sr-only">{message}</p>}{error && <p role="alert" className="mn-inline-error">{error}</p>}</div>;
}
