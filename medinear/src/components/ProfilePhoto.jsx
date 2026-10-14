import { useEffect, useRef, useState } from 'react';
import api from '../api/api';
import { photoSource, uploadProfilePhoto, validatePhotoFile } from '../utils/profilePhoto';

export function ProfileAvatar({ src, name, initials }) {
  const [failedSource, setFailedSource] = useState('');
  return <div className="mn-profile-avatar">{src && src !== failedSource ? <img src={src} alt={`${name}'s profile photo`} onError={() => setFailedSource(src)} /> : <span aria-label={`${name}'s initials`}>{initials}</span>}</div>;
}

export function PhotoControls({ preview, busy, disabled, error, message, onChoose, onSave, onCancel }) {
  return <div className="mn-profile-photo-controls" aria-busy={busy}>
    <button type="button" className="mn-text-button" onClick={onChoose} disabled={busy || disabled}>Change Photo</button>
    <p className="mn-profile-help">JPEG, PNG or WebP. Maximum 2 MB.</p>
    {preview && <><p className="mn-profile-help" role="status">Photo preview. Save to apply this change.</p><div className="mn-profile-photo-actions"><button type="button" className="mn-button mn-primary" disabled={busy || disabled} onClick={onSave}>{busy ? 'Saving Photo...' : 'Save Photo'}</button><button type="button" className="mn-button mn-secondary" disabled={busy} onClick={onCancel}>Cancel</button></div></>}
    {error && <p className="mn-profile-help mn-photo-error" role="alert">{error}</p>}
    {message && <p className="mn-profile-help" role="status">{message}</p>}
  </div>;
}

export default function ProfilePhoto({ user, initials, onSaved, onBusyChange, disabled = false }) {
  const picker = useRef(null), pending = useRef(false);
  const [selection, setSelection] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  useEffect(() => () => { if (selection?.url) URL.revokeObjectURL(selection.url); }, [selection]);
  function choose(event) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    const problem = validatePhotoFile(file); setMessage('');
    if (problem) { setError(problem); return; }
    setError(''); setSelection({ file, url: URL.createObjectURL(file) });
  }
  function cancel() { setSelection(null); setError(''); setMessage(''); }
  async function save() {
    if (pending.current || !selection || disabled) return;
    pending.current = true; setBusy(true); onBusyChange?.(true); setError(''); setMessage('');
    try {
      const result = await uploadProfilePhoto(api, selection.file, localStorage.getItem('token'));
      onSaved(result.profileImage); setSelection(null); setMessage(result.message || 'Profile photo saved.');
    } catch (e) { setSelection(null); setError(e.response?.data?.message || 'Unable to save photo. Your existing photo has not changed.'); }
    finally { pending.current = false; setBusy(false); onBusyChange?.(false); }
  }
  return <div className="mn-profile-photo"><ProfileAvatar src={selection?.url || photoSource(user.profileImage, api.defaults.baseURL)} name={user.name} initials={initials} />
    {user.role === 'customer' && <><input ref={picker} className="mn-photo-input" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose profile photo" onChange={choose} disabled={busy || disabled} /><PhotoControls preview={!!selection} busy={busy} disabled={disabled} error={error} message={message} onChoose={() => picker.current?.click()} onSave={save} onCancel={cancel} /></>}
  </div>;
}
