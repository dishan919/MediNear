import { photoFeedback } from '../utils/toastFeedback';
import { useToast } from '../auth/ToastContext';
import { useEffect, useRef, useState } from 'react';
import api from '../api/api';
import { photoSource, uploadProfilePhoto, removeProfilePhoto, validatePhotoFile } from '../utils/profilePhoto';

export function ProfileAvatar({ src, name, initials }) {
  const [failedSource, setFailedSource] = useState('');
  return <div className="mn-profile-avatar">{src && src !== failedSource ? <img src={src} alt={`${name}'s profile photo`} onError={() => setFailedSource(src)} /> : <span aria-label={`${name}'s initials`}>{initials}</span>}</div>;
}

export function PhotoControls({ preview, busy, disabled, error, message, onChoose, onSave, onCancel, hasPhoto = false, confirming = false, removing = false, onRemoveRequest, onRemoveConfirm, onRemoveCancel, cancelRef, removeRef }) {
  return <div className="mn-profile-photo-controls" aria-busy={busy}>
    <button type="button" className="mn-text-button" onClick={onChoose} disabled={busy || disabled || confirming}>Change Photo</button>
    {hasPhoto && !confirming && <button ref={removeRef} type="button" className="mn-button mn-danger" disabled={busy || disabled || preview} onClick={onRemoveRequest}>Remove Photo</button>}
    {confirming && <div className="mn-photo-confirmation" role="group" aria-label="Remove profile photo?">
      <p>Remove profile photo?</p><div className="mn-profile-photo-actions">
        <button ref={cancelRef} type="button" className="mn-button mn-secondary" disabled={busy} onClick={onRemoveCancel}>Cancel</button>
        <button type="button" className="mn-button mn-danger" disabled={busy || disabled} onClick={onRemoveConfirm}>{removing ? 'Removing...' : 'Remove'}</button>
      </div>
    </div>}
    <p className="mn-profile-help">JPEG, PNG or WebP. Maximum 2 MB.</p>
    {preview && <><p className="mn-profile-help" role="status">Photo preview. Save to apply this change.</p><div className="mn-profile-photo-actions"><button type="button" className="mn-button mn-primary" disabled={busy || disabled} onClick={onSave}>{busy ? 'Saving Photo...' : 'Save Photo'}</button><button type="button" className="mn-button mn-secondary" disabled={busy} onClick={onCancel}>Cancel</button></div></>}
    {error && <p className="mn-profile-help mn-photo-error" role="alert">{error}</p>}
    {message && <p className="mn-profile-help" role="status">{message}</p>}
  </div>;
}

export default function ProfilePhoto({ user, initials, onSaved, onBusyChange, disabled = false }) {
  const { showToast } = useToast();
  const picker = useRef(null), pending = useRef(false), cancelRef = useRef(null), removeRef = useRef(null);
  const [confirming, setConfirming] = useState(false), [removing, setRemoving] = useState(false);
  useEffect(() => { if (confirming) cancelRef.current?.focus(); }, [confirming]);
  const [selection, setSelection] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  useEffect(() => () => { if (selection?.url) URL.revokeObjectURL(selection.url); }, [selection]);
  function choose(event) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file || pending.current || disabled || confirming) return;
    const problem = validatePhotoFile(file); setMessage('');
    if (problem) { setError(problem); return; }
    setError(''); setSelection({ file, url: URL.createObjectURL(file) });
  }
  function cancel() { setSelection(null); setError(''); setMessage(''); }
  async function save() {
    if (pending.current || !selection || disabled || confirming) return;
    pending.current = true; setBusy(true); onBusyChange?.(true); setError(''); setMessage('');
    try {
      const result = await uploadProfilePhoto(api, selection.file, localStorage.getItem('token'));
      onSaved(result.profileImage); setSelection(null); showToast(photoFeedback());
    } catch (e) { setSelection(null); setError(e.response?.data?.message || 'Unable to save photo. Your existing photo has not changed.'); }
    finally { pending.current = false; setBusy(false); onBusyChange?.(false); }
  }
  function requestRemove() {
    if (pending.current || disabled || selection || !user.profileImage) return;
    setError(''); setMessage(''); setConfirming(true);
  }
  function cancelRemove() {
    if (pending.current) return;
    setConfirming(false); setError('');
    // The trigger is rendered again after the confirmation closes.
    requestAnimationFrame(() => removeRef.current?.focus());
  }
  async function remove() {
    if (pending.current || !confirming || disabled) return;
    pending.current = true; setBusy(true); setRemoving(true); onBusyChange?.(true); setError(''); setMessage('');
    try {
      const result = await removeProfilePhoto(api, localStorage.getItem('token'));
      onSaved(result.user.profileImage); setSelection(null); setConfirming(false);
      showToast(photoFeedback(true));
    } catch (e) { setError(e.response?.data?.message || 'Unable to remove photo. Please try again.'); }
    finally { pending.current = false; setBusy(false); setRemoving(false); onBusyChange?.(false); }
  }
  return <div className="mn-profile-photo"><ProfileAvatar src={selection?.url || photoSource(user.profileImage, api.defaults.baseURL)} name={user.name} initials={initials} />
    {user.role === 'customer' && <><input ref={picker} className="mn-photo-input" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose profile photo" onChange={choose} disabled={busy || disabled || confirming} /><PhotoControls preview={!!selection} busy={busy} disabled={disabled} error={error} message={message} onChoose={() => picker.current?.click()} onSave={save} onCancel={cancel} hasPhoto={!!user.profileImage} confirming={confirming} removing={removing} onRemoveRequest={requestRemove} onRemoveConfirm={remove} onRemoveCancel={cancelRemove} cancelRef={cancelRef} removeRef={removeRef} /></>}
  </div>;
}
