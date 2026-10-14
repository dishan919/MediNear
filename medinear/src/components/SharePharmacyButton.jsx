import { useId, useRef, useState } from 'react';
import Icon from './Icon';
import { sharePharmacy } from '../utils/sharePharmacy';

export function ShareFeedback({ result, inputId }) {
  if (!result?.message) return null;
  return <div className="mn-share-feedback" role={result.status === 'error' ? 'alert' : 'status'}>
    <p>{result.message}</p>{result.url && <><label htmlFor={inputId}>Or copy this pharmacy link:</label><input id={inputId} type="text" readOnly value={result.url} onFocus={event => event.target.select()} /></>}
  </div>;
}
export default function SharePharmacyButton({ pharmacy }) {
  const [busy, setBusy] = useState(false), [result, setResult] = useState(null);
  const pending = useRef(false), id = useId();
  async function share() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setResult(null);
    try { setResult(await sharePharmacy(pharmacy)); }
    catch { setResult({ status: 'error', message: 'Unable to share this pharmacy. Please try again.' }); }
    finally { pending.current = false; setBusy(false); }
  }
  return <div className="mn-share-action"><button type="button" className="mn-button mn-secondary" aria-label={`Share ${pharmacy.name}`} aria-busy={busy} disabled={busy} onClick={share}><Icon name="share" size={18} />{busy ? 'Sharing...' : 'Share'}</button><ShareFeedback result={result} inputId={`${id}-link`} /></div>;
}
