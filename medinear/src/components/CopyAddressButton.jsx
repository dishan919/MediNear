import { useEffect, useRef, useState } from 'react';
import { copyPharmacyAddress } from '../utils/copyPharmacyAddress';
export function CopyAddressControl({ address, busy, result, onCopy }) {
  if (!address) return null;
  return <div className="mn-copy-address"><button type="button" className="mn-text-button" aria-label="Copy pharmacy address" aria-busy={busy} disabled={busy} onClick={onCopy}>{busy ? 'Copying...' : 'Copy Address'}</button>
    {result?.message && <p role={result.status === 'error' ? 'alert' : 'status'}>{result.message}</p>}
  </div>;
}
export default function CopyAddressButton({ address }) {
  const [busy, setBusy] = useState(false), [result, setResult] = useState(null);
  const pending = useRef(false), mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function copy() {
    if (pending.current || !address) return;
    pending.current = true; setBusy(true); setResult(null);
    try { const response = await copyPharmacyAddress(address); if (mounted.current) setResult(response); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  }
  return <CopyAddressControl address={address} busy={busy} result={result} onCopy={copy} />;
}
