import { favoriteFeedback } from '../utils/toastFeedback';
import { useToast } from '../auth/ToastContext';
import { useEffect, useRef, useState } from 'react';
import api from '../api/api';
import { favoritesService } from '../api/favorites';
import Icon from './Icon';
export default function FavoriteButton({ pharmacyId, initiallyFavorite = false, onChange, showLabel = false, disabled = false }) {
  const { showToast } = useToast();
  const [favorite, setFavorite] = useState(initiallyFavorite), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const pending = useRef(false);
  useEffect(() => { setFavorite(initiallyFavorite); }, [initiallyFavorite]);
  async function toggle() {
    if (pending.current || disabled) return;
    pending.current = true; setBusy(true); setError('');
    try {
      const result = await favoritesService(api, localStorage).setSaved(pharmacyId, !favorite);
      setFavorite(result.saved); showToast(favoriteFeedback(result.saved)); onChange?.(pharmacyId, result.saved);
    } catch (e) { setError(e.response?.data?.message || 'Unable to update saved pharmacy.'); }
    finally { pending.current = false; setBusy(false); }
  }
  return <div className="mn-favorite"><button type="button" className={`mn-button ${showLabel ? 'mn-secondary' : 'mn-icon-button'} ${favorite ? 'mn-saved' : ''}`} aria-label={favorite ? 'Remove from saved pharmacies' : 'Save Pharmacy'} aria-pressed={favorite} aria-busy={busy} disabled={busy || disabled} onClick={toggle}><Icon name="heart" fill={favorite ? 'currentColor' : 'none'} />{showLabel && (busy ? 'Updating...' : favorite ? 'Saved' : 'Save Pharmacy')}</button>{error && <p role="alert" className="mn-inline-error">{error}</p>}</div>;
}
