let pending;
export function loadGoogleMaps() {
  if (globalThis.google?.maps?.importLibrary) return Promise.resolve(globalThis.google.maps);
  if (pending) return pending;
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!key) return Promise.reject(new Error('Map configuration unavailable. Google Maps directions still work.'));
  pending = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
    const timeout = setTimeout(() => reject(new Error('Google Map could not load. Use Directions to open Google Maps.')), 15000);
    function finish() { clearTimeout(timeout); resolve(globalThis.google.maps); }
    if (existing) {
      if (globalThis.google?.maps?.Map) finish();
      else { existing.addEventListener('load', finish, { once: true }); existing.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('Map failed to load')); }, { once: true }); }
      return;
    }
    globalThis.medinearMapReady = () => { finish(); delete globalThis.medinearMapReady; };
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?${new URLSearchParams({ key, loading: 'async', callback: 'medinearMapReady', v: 'weekly' })}`;
    script.onerror = () => { clearTimeout(timeout); reject(new Error('Map failed to load')); };
    document.head.append(script);
  });
  return pending;
}
