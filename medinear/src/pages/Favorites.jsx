import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/api';
import { favoritesService } from '../api/favorites';
import PharmacyCard from '../components/PharmacyCard';
import NotificationBell from '../components/NotificationBell';
import Icon from '../components/Icon';
import '../styles/MedicineUI.css';
import '../styles/Favorites.css';
export function FavoritesView({ favorites, loading, error, onRetry, onFavoriteChange }) {
  return <main className="mn-app mn-favorites"><header className="mn-site-header"><Link className="mn-logo" to="/"><span><Icon name="cross" /></span>MediNear</Link><nav aria-label="Customer navigation"><NotificationBell /><Link to="/">Search</Link><Link to="/profile">My profile</Link></nav></header><section className="mn-favorites-inner"><div className="mn-section-header"><div><h1>Saved Pharmacies</h1><p>Your pharmacies, saved to your account.</p></div></div>
    {loading ? <div className="mn-empty" role="status">Loading saved pharmacies...</div> : error ? <div className="mn-empty" role="alert"><p>{error}</p><button type="button" className="mn-button mn-primary" onClick={onRetry}>Try again</button></div> : favorites.length ? <div className="mn-saved-grid">{favorites.map(pharmacy => <PharmacyCard key={pharmacy._id} pharmacy={pharmacy} initiallyFavorite onFavoriteChange={onFavoriteChange} savedList />)}</div> : <div className="mn-empty"><Icon name="heart" size={32} /><h2>No saved pharmacies yet.</h2><p>Find a pharmacy and choose Save Pharmacy to keep it here.</p><Link to="/" className="mn-button mn-primary">Find Medicines &amp; Pharmacies</Link></div>}
  </section></main>;
}
export default function Favorites() {
  const [favorites, setFavorites] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    favoritesService(api, localStorage).list(controller.signal).then(items => { if (!controller.signal.aborted) setFavorites(items); })
      .catch(e => { if (!controller.signal.aborted) setError(e.response?.data?.message || 'Unable to load saved pharmacies.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [retry]);
  return <FavoritesView favorites={favorites} loading={loading} error={error} onRetry={() => setRetry(value => value + 1)} onFavoriteChange={(id, saved) => { if (!saved) setFavorites(items => items.filter(p => p._id !== id)); }} />;
}
