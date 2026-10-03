import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/api';
import PharmacyCard from '../components/PharmacyCard';
import PharmacyMap from '../components/PharmacyMap';
import Icon from '../components/Icon';
import { coordinatesFromSearch } from '../utils/medicineDisplay';
import '../styles/MedicineUI.css';
import '../styles/Home.css';
export default function Home() {
  const [params, setParams] = useSearchParams();
  const queryString = params.toString();
  const medicine = params.get('medicine') || '';
  const [pharmacies, setPharmacies] = useState([]), [favoriteIds, setFavoriteIds] = useState([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  const [selectedId, setSelectedId] = useState('');
  const [locationMessage, setLocationMessage] = useState('Use your location to find pharmacies nearby.');
  const [locating, setLocating] = useState(false);
  const location = useMemo(() => coordinatesFromSearch(queryString), [queryString]);
  const pharmacyText = params.get('pharmacy') || '';
  function changeParam(key, value) {
    setParams(previous => { const next = new URLSearchParams(previous); if (value) next.set(key, String(value)); else next.delete(key); return next; }, { replace: true });
  }
  function locate() {
    if (!navigator.geolocation) { setLocationMessage('Location unavailable. You can still search pharmacies.'); return; }
    setLocating(true); setLocationMessage('Finding your location...');
    navigator.geolocation.getCurrentPosition(position => {
      setParams(previous => { const next = new URLSearchParams(previous); next.set('lat', String(position.coords.latitude)); next.set('lng', String(position.coords.longitude)); return next; }, { replace: true });
      setLocationMessage('Your location is ready. Distances are straight-line estimates.'); setLocating(false);
    }, () => {
      setParams(previous => { const next = new URLSearchParams(previous); ['lat', 'lng', 'radius'].forEach(key => next.delete(key)); return next; }, { replace: true });
      setLocationMessage('Location denied or unavailable. Search still works without distance.'); setLocating(false);
    }, { timeout: 10000, maximumAge: 60000 });
  }
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    const timer = setTimeout(async () => {
      try {
        const query = new URLSearchParams(queryString);
        const response = await api.get('/pharmacies/search', { params: {
          medicine: query.get('medicine') || '', openNow: query.get('openNow') === 'true', hour24: query.get('hour24') === 'true', emergency: query.get('emergency') === 'true',
          ...(location ? { ...location, ...(query.get('radius') ? { radius: query.get('radius') } : {}) } : {}),
        }, signal: controller.signal });
        if (!controller.signal.aborted) setPharmacies(response.data.pharmacies || []);
      } catch (e) { if (!controller.signal.aborted) setError(e.response?.data?.message || 'Unable to load pharmacies. Please try again.'); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [queryString, retry, location]);
  useEffect(() => {
    const controller = new AbortController();
    api.get('/users/favorites', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }, signal: controller.signal }).then(response => setFavoriteIds((response.data.favorites || []).map(p => p._id))).catch(() => {});
    return () => controller.abort();
  }, []);
  const filtered = useMemo(() => pharmacies.filter(p => [p.name, p.address, p.district].some(value => (value || '').toLowerCase().includes(pharmacyText.trim().toLowerCase()))), [pharmacies, pharmacyText]);
  const selectPharmacy = useCallback(id => { setSelectedId(id); document.getElementById('pharmacy-map')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, []);
  function favoriteChange(id, saved) { setFavoriteIds(previous => saved ? [...new Set([...previous, id])] : previous.filter(value => value !== id)); }
  return <main className="mn-app mn-home">
    <header className="mn-site-header"><Link to="/" className="mn-logo"><span><Icon name="cross" /></span>MediNear</Link><nav aria-label="Customer navigation"><Link to="/favorites"><Icon name="heart" size={18} />Saved pharmacies</Link><Link to="/profile">My profile</Link></nav></header>
    <section className="mn-search-hero"><div className="mn-hero-inner"><div className="mn-hero-copy"><p className="mn-eyebrow"><Icon name="pill" size={17} />Your neighborhood pharmacy finder</p><h1>Find Medicines<br /><span>Near You</span></h1><p className="mn-hero-description">Search and find available medicines at nearby pharmacies</p></div><div className="mn-hero-symbol" aria-hidden="true"><Icon name="cross" size={90} /><span>Care, closer to home.</span></div></div>
      <div className="mn-search-panel"><form className="mn-search-form" onSubmit={e => { e.preventDefault(); setRetry(value => value + 1); }}><label className="mn-search-field"><span className="mn-sr-only">Medicine search</span><Icon name="search" /><input type="search" placeholder="Search medicine..." value={medicine} maxLength={120} onChange={e => changeParam('medicine', e.target.value)} /></label><button className="mn-button mn-primary" type="submit">Search<Icon name="arrow" size={18} /></button></form>
        <div className="mn-filter-row">{[['openNow', 'Open Now'], ['hour24', '24 Hour'], ['emergency', 'Emergency Mode']].map(([key, label]) => <label className={`mn-filter ${params.get(key) === 'true' ? 'mn-filter-active' : ''}`} key={key}><input type="checkbox" checked={params.get(key) === 'true'} onChange={e => changeParam(key, e.target.checked ? 'true' : '')} />{label}</label>)}<label className="mn-distance-filter"><Icon name="pin" size={16} /><span>Distance</span><select aria-label="Distance radius" disabled={!location} value={params.get('radius') || ''} onChange={e => changeParam('radius', e.target.value)}><option value="">Any distance</option>{[1, 5, 10, 25, 50].map(km => <option value={km} key={km}>Within {km} km</option>)}</select></label><button className="mn-text-button" type="button" onClick={locate} disabled={locating}><Icon name="pin" size={16} />{locating ? 'Locating...' : 'Use current location'}</button></div>
        <p className="mn-location-note" role="status">{location && !locating ? 'Using your location. Distances are straight-line estimates.' : locationMessage}{!location && ' Enable location to filter by distance.'}</p>
      </div>
    </section>
    <section className="mn-results" aria-busy={loading}><div className="mn-section-header"><div><p className="mn-eyebrow">Recommended for you</p><h2>{medicine ? 'Available Pharmacies' : 'Explore pharmacies'}</h2><p>{medicine ? `Pharmacies with ${medicine} in stock` : 'Find opening hours, medicine availability and directions.'}</p></div>{!loading && !error && <span className="mn-result-count">{filtered.length} {filtered.length === 1 ? 'pharmacy' : 'pharmacies'}</span>}</div>
      <div className="mn-results-toolbar"><label><Icon name="search" size={17} /><span className="mn-sr-only">Filter pharmacy or location</span><input type="search" placeholder="Filter pharmacy or location..." value={pharmacyText} onChange={e => changeParam('pharmacy', e.target.value)} /></label><p><Icon name="shield" size={16} />Ranked by availability, opening status and distance</p></div>
      {loading ? <div className="mn-empty" role="status"><Icon name="search" size={30} /><h3>Finding your pharmacies...</h3></div> : error ? <div className="mn-empty" role="alert"><h3>We couldn't load your results</h3><p>{error}</p><button className="mn-button mn-primary" onClick={() => setRetry(value => value + 1)}>Try again</button></div> : !filtered.length ? <div className="mn-empty"><Icon name="pill" size={36} /><h3>No pharmacies found</h3><p>Try another medicine or adjust your filters.</p><button className="mn-button mn-secondary" onClick={() => setParams(location ? { lat: location.lat, lng: location.lng } : {}, { replace: true })}>Clear filters</button></div> : <div className="mn-result-grid">{filtered.map(p => <PharmacyCard key={p._id} pharmacy={p} initiallyFavorite={favoriteIds.includes(p._id)} onFavoriteChange={favoriteChange} onViewMap={selectPharmacy} selected={selectedId === p._id} />)}</div>}
    </section>
    <PharmacyMap pharmacies={error || loading ? [] : filtered} location={location} selectedId={selectedId} onSelect={selectPharmacy} />
  </main>;
}
