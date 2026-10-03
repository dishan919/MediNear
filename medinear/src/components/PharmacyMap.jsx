import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '../maps/googleMaps';
export default function PharmacyMap({ pharmacies, location, selectedId, onSelect }) {
  const element = useRef(null), map = useRef(null), markers = useRef(new Map());
  const [ready, setReady] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    loadGoogleMaps().then(async maps => {
      await Promise.all([maps.importLibrary('maps'), maps.importLibrary('marker')]);
      if (!active) return;
      if (!map.current) map.current = new maps.Map(element.current, { center: { lat: 6.9271, lng: 79.8612 }, zoom: 12, mapId: import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID' });
      setReady(true);
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!ready) return;
    const maps = globalThis.google.maps, bounds = new maps.LatLngBounds(), created = [];
    markers.current.clear();
    for (const p of pharmacies) {
      if (!Number.isFinite(p.latitude) || !Number.isFinite(p.longitude)) continue;
      const position = { lat: p.latitude, lng: p.longitude };
      const marker = new maps.marker.AdvancedMarkerElement({ map: map.current, position, title: `${p.name}: ${p.openStatus}` });
      const listener = marker.addListener('click', () => onSelect(p._id));
      created.push({ marker, listener }); markers.current.set(p._id, marker); bounds.extend(position);
    }
    if (location) {
      const marker = new maps.marker.AdvancedMarkerElement({ map: map.current, position: location, title: 'Your current location' });
      created.push({ marker }); bounds.extend(location);
    }
    if (!bounds.isEmpty()) { map.current.fitBounds(bounds); if (created.length === 1) map.current.setZoom(14); }
    return () => { created.forEach(({ marker, listener }) => { listener?.remove(); marker.map = null; }); };
  }, [ready, pharmacies, location, onSelect]);
  useEffect(() => {
    const marker = markers.current.get(selectedId);
    if (ready && marker) { map.current.panTo(marker.position); map.current.setZoom(15); }
  }, [ready, selectedId, pharmacies]);
  const selected = pharmacies.find(p => p._id === selectedId);
  return <section id="pharmacy-map" className="results-map" aria-label="Google pharmacy map">
    <h2>Pharmacies on Google Maps</h2>
    {error && <p role="status">{error}</p>}
    <div ref={element} style={{ height: error ? 0 : 380, borderRadius: 14 }} />
    {selected && <p>{selected.name} · {selected.openStatus} · {selected.address}</p>}
  </section>;
}
