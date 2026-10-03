import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import api from '../api/api';
import AssetImage from '../components/AssetImage';
import FavoriteButton from '../components/FavoriteButton';
import MedicineCard from '../components/MedicineCard';
import PharmacyMap from '../components/PharmacyMap';
import Icon from '../components/Icon';
import { coordinatesFromSearch, directionsUrl, filterMedicines } from '../utils/medicineDisplay';
import '../styles/MedicineUI.css';
import '../styles/PharmacyDetails.css';
const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export function PharmacyDetailsView({ pharmacy, backTo = '/', location, favorite = false, onLocate, locating = false }) {
  const [tab, setTab] = useState('Medicines'), [query, setQuery] = useState('');
  const filtered = filterMedicines(pharmacy.medicines || [], query);
  const select = useCallback(() => {}, []);
  const mapPharmacies = useMemo(() => [pharmacy], [pharmacy]);
  return <>
    <Link className="mn-back-link" to={backTo}><Icon name="back" size={18} />Back to Search</Link>
    <section className="mn-detail-header"><AssetImage src={pharmacy.image} kind="pharmacy" alt={`${pharmacy.name} pharmacy`} className="mn-detail-photo" /><div className="mn-detail-summary"><div className="mn-badge-row"><span className={`mn-badge ${pharmacy.isOpen === true ? 'mn-positive' : pharmacy.isOpen === false ? 'mn-negative' : 'mn-neutral'}`}>{pharmacy.openStatus || 'Hours unavailable'}</span>{pharmacy.open24Hours && <span className="mn-badge mn-blue">24 Hours</span>}</div><h1>{pharmacy.name}</h1><p className="mn-detail-hours"><Icon name="clock" size={18} />{pharmacy.hoursToday || 'Hours unavailable'}<span>{pharmacy.timezone}</span></p><p className="mn-detail-address"><Icon name="pin" size={18} />{pharmacy.address}{pharmacy.district ? `, ${pharmacy.district}` : ''}</p><p className="mn-detail-distance">{pharmacy.distance == null ? 'Distance unavailable' : `${pharmacy.distance.toFixed(1)} km away`}{pharmacy.distance == null && onLocate && <button className="mn-text-button" disabled={locating} onClick={onLocate}>{locating ? 'Locating...' : 'Use current location'}</button>}</p><div className="mn-detail-actions"><a className="mn-button mn-primary" href={`tel:${pharmacy.phone}`}><Icon name="phone" size={18} />Call Pharmacy</a><a className="mn-button mn-secondary" href={directionsUrl(pharmacy)} target="_blank" rel="noopener noreferrer"><Icon name="pin" size={18} />Directions</a><FavoriteButton pharmacyId={pharmacy._id} initiallyFavorite={favorite} showLabel /></div></div></section>
    <div className="mn-tabs" role="tablist" aria-label="Pharmacy information">{['Medicines', 'About', 'Opening Hours', 'Location'].map(label => <button role="tab" type="button" id={`tab-${label.replaceAll(' ', '-')}`} key={label} aria-selected={tab === label} aria-controls="pharmacy-panel" tabIndex={tab === label ? 0 : -1} onClick={() => setTab(label)} onKeyDown={e => {
      const labels = ['Medicines', 'About', 'Opening Hours', 'Location']; const index = labels.indexOf(tab);
      const target = e.key === 'ArrowRight' ? (index + 1) % 4 : e.key === 'ArrowLeft' ? (index + 3) % 4 : e.key === 'Home' ? 0 : e.key === 'End' ? 3 : -1;
      if (target >= 0) { e.preventDefault(); setTab(labels[target]); document.getElementById(`tab-${labels[target].replaceAll(' ', '-')}`)?.focus(); }
    }}>{label}{label === 'Medicines' && <span>{pharmacy.medicines?.length || 0}</span>}</button>)}</div>
    <section className="mn-detail-panel" id="pharmacy-panel" role="tabpanel" aria-labelledby={`tab-${tab.replaceAll(' ', '-')}`} tabIndex={0}>
      {tab === 'Medicines' && <><div className="mn-section-header"><div><p className="mn-eyebrow">Browse the inventory</p><h2>Available Medicines</h2><p>Current stock, including out-of-stock items, from this pharmacy.</p></div><span className="mn-result-count">{filtered.length} {filtered.length === 1 ? 'medicine' : 'medicines'}</span></div><label className="mn-local-search"><Icon name="search" /><span className="mn-sr-only">Search medicines in this pharmacy</span><input type="search" value={query} placeholder="Search medicines in this pharmacy..." onChange={e => setQuery(e.target.value)} /></label>{filtered.length ? <div className="mn-medicine-grid">{filtered.map(m => <MedicineCard key={m._id} medicine={m} timezone={pharmacy.timezone} />)}</div> : <div className="mn-empty"><Icon name="pill" size={32} /><h3>{query ? 'No matching medicines' : 'No medicines listed yet'}</h3><p>{query ? 'Try a medicine name, generic name or brand.' : 'This pharmacy has not added inventory yet.'}</p></div>}<p className="mn-stock-note"><Icon name="clock" size={16} />Stock reflects the latest pharmacy update. Contact the pharmacy to confirm availability.</p></>}
      {tab === 'About' && <><h2>About this pharmacy</h2><dl className="mn-about-grid"><div><dt>Pharmacy</dt><dd>{pharmacy.name}</dd></div><div><dt>Address</dt><dd>{pharmacy.address}</dd></div><div><dt>District</dt><dd>{pharmacy.district}</dd></div><div><dt>Phone</dt><dd><a href={`tel:${pharmacy.phone}`}>{pharmacy.phone}</a></dd></div></dl></>}
      {tab === 'Opening Hours' && <><h2>Weekly opening hours</h2><p className="mn-muted">All times in {pharmacy.timezone}.</p>{pharmacy.openStatus === 'Hours unavailable' || !pharmacy.openingHours?.length ? <div className="mn-empty"><Icon name="clock" size={30} /><h3>Hours unavailable</h3><p>Call the pharmacy to confirm its opening hours.</p></div> : <dl className="mn-weekly-hours">{[...pharmacy.openingHours].sort((a, b) => a.day - b.day).map(h => <div key={h.day}><dt>{days[h.day]}</dt><dd>{h.closed ? 'Closed' : h.allDay ? '24 hours' : `${h.open} – ${h.close}${h.close < h.open ? ' (next day)' : ''}`}</dd></div>)}</dl>}</>}
      {tab === 'Location' && <><h2>Location & directions</h2><p className="mn-muted">{pharmacy.address}, {pharmacy.district}</p><PharmacyMap pharmacies={mapPharmacies} location={location} selectedId={pharmacy._id} onSelect={select} /><a className="mn-button mn-primary" href={directionsUrl(pharmacy)} target="_blank" rel="noopener noreferrer">Open Google Maps<Icon name="arrow" size={18} /></a></>}
    </section>
  </>;
}
export default function PharmacyDetails() {
  const { id } = useParams();
  const route = useLocation();
  const [params, setParams] = useSearchParams();
  const location = useMemo(() => coordinatesFromSearch(params.toString()), [params]);
  const [pharmacy, setPharmacy] = useState(null), [favorite, setFavorite] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState(''), [retry, setRetry] = useState(0), [locationMessage, setLocationMessage] = useState(''), [locating, setLocating] = useState(false);
  const backTo = /^\/(\?|$)/.test(route.state?.returnTo || '') ? route.state.returnTo : '/';
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    api.get(`/pharmacies/${id}`, { params: location || {}, signal: controller.signal }).then(response => { if (!controller.signal.aborted) setPharmacy(response.data.pharmacy); }).catch(e => { if (!controller.signal.aborted) setError(e.response?.data?.message || 'Unable to load this pharmacy.'); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, location, retry]);
  useEffect(() => {
    const controller = new AbortController();
    api.get('/users/favorites', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }, signal: controller.signal }).then(response => setFavorite((response.data.favorites || []).some(p => p._id === id))).catch(() => {});
    return () => controller.abort();
  }, [id]);
  function locate() {
    if (!navigator.geolocation) { setLocationMessage('Location unavailable.'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(p => { setParams({ lat: p.coords.latitude, lng: p.coords.longitude }, { replace: true }); setLocating(false); setLocationMessage(''); }, () => { setLocating(false); setLocationMessage('Location denied or unavailable. Directions still work.'); }, { timeout: 10000, maximumAge: 60000 });
  }
  return <main className="mn-app mn-details"><header className="mn-site-header"><Link className="mn-logo" to="/"><span><Icon name="cross" /></span>MediNear</Link><span className="mn-muted">Your neighborhood pharmacy finder</span></header><div className="mn-details-inner">{loading ? <div className="mn-empty" role="status"><h2>Loading pharmacy...</h2></div> : error ? <div className="mn-empty" role="alert"><h2>Unable to open this pharmacy</h2><p>{error}</p><button className="mn-button mn-primary" onClick={() => setRetry(value => value + 1)}>Try again</button><Link className="mn-back-link" to={backTo}>Back to Search</Link></div> : pharmacy && <PharmacyDetailsView key={id} pharmacy={pharmacy} backTo={backTo} location={location} favorite={favorite} onLocate={locate} locating={locating} />}{locationMessage && <p className="mn-location-note" role="status">{locationMessage}</p>}</div></main>;
}
