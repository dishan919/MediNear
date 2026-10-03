import { useEffect, useState } from 'react';
import api from '../api/api';
import Icon from './Icon';
export default function FavoriteButton({ pharmacyId, initiallyFavorite = false, onChange, showLabel = false }) {
  const [favorite, setFavorite] = useState(initiallyFavorite), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { setFavorite(initiallyFavorite); }, [initiallyFavorite]);
  async function toggle() {
    setBusy(true); setError('');
    try {
      const config = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } };
      if (favorite) await api.delete(`/users/favorites/${pharmacyId}`, config);
      else await api.post(`/users/favorites/${pharmacyId}`, {}, config);
      setFavorite(!favorite); onChange?.(pharmacyId, !favorite);
    } catch (e) { setError(e.response?.data?.message || 'Unable to update favorite.'); }
    finally { setBusy(false); }
  }
  return <div className="mn-favorite"><button type="button" className={`mn-button ${showLabel ? 'mn-secondary' : 'mn-icon-button'} ${favorite ? 'mn-saved' : ''}`} aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'} aria-pressed={favorite} disabled={busy} onClick={toggle}><Icon name="heart" fill={favorite ? 'currentColor' : 'none'} />{showLabel && (favorite ? 'Saved' : 'Save pharmacy')}</button>{error && <p role="alert" className="mn-inline-error">{error}</p>}</div>;
}
