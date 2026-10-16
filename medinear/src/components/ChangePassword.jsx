import { useEffect, useRef, useState } from 'react';
import AuthField from './AuthField';
import api from '../api/api';
import { useToast } from '../auth/ToastContext';
import { createPasswordSubmission } from '../utils/changePassword';
import '../styles/Auth.css';

const emptyFields = () => ({ currentPassword: '', newPassword: '', confirmPassword: '' });
export function ChangePasswordForm({ values, errors, error, busy, onChange, onSubmit, formRef }) {
  return <section className="mn-change-password mn-profile-information" aria-labelledby="change-password-title">
    <h3 id="change-password-title">Change Password</h3>
    <form ref={formRef} onSubmit={onSubmit} noValidate aria-busy={busy}>
      {error && <p className="mn-profile-notice mn-profile-error" role="alert">{error}</p>}
      <div className="mn-profile-grid">
        {[['currentPassword', 'Current Password'], ['newPassword', 'New Password'], ['confirmPassword', 'Confirm New Password']].map(([name, label]) =>
          <div className="mn-profile-field" key={name}><AuthField name={name} label={label} type="password" autoComplete={name === 'currentPassword' ? 'current-password' : 'new-password'} value={values[name]} onChange={onChange} error={errors[name]} disabled={busy} /></div>)}
      </div>
      <p className="mn-profile-help">Use at least 8 characters with uppercase, lowercase and a number (maximum 72 bytes).</p>
      <div className="mn-profile-actions"><button type="submit" className="mn-button mn-primary" disabled={busy}>{busy ? 'Changing Password...' : 'Change Password'}</button></div>
    </form>
  </section>;
}
export default function ChangePassword() {
  const { showToast } = useToast();
  const formRef = useRef(null), focusRequested = useRef(false);
  const [values, setValues] = useState(emptyFields);
  const [errors, setErrors] = useState({}), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [submission] = useState(() => createPasswordSubmission(api, {
    errors(nextErrors) { focusRequested.current = true; setErrors(nextErrors); }, error: setError, busy: setBusy,
    success() { setValues(emptyFields()); setErrors({}); showToast({ message: 'Password changed successfully.', type: 'success' }); },
  }, () => localStorage.getItem('token')));
  useEffect(() => { submission.activate(); return () => submission.dispose(); }, [submission]);
  function change(event) {
    const { name, value } = event.target;
    setValues(current => ({ ...current, [name]: value }));
    setErrors(current => ({ ...current, [name]: undefined })); setError('');
  }
  useEffect(() => {
    if (focusRequested.current) {
      formRef.current?.querySelector('[aria-invalid="true"]')?.focus();
      focusRequested.current = false;
    }
  }, [errors]);
  function submit(event) {
    event.preventDefault();
    submission.submit(values);
  }
  return <ChangePasswordForm formRef={formRef} values={values} errors={errors} error={error} busy={busy} onChange={change} onSubmit={submit} />;
}
