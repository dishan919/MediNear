import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAlerts } from '../auth/AlertsContext';
import { alertApi } from '../api/alerts';
import NotificationBell from '../components/NotificationBell';
import Icon from '../components/Icon';
import '../styles/MedicineUI.css';
export function NotificationsView({ notifications, busy, onRead }) {
  if (!notifications.length) return <p className="mn-empty">No notifications yet.</p>;
  return <div className="mn-notifications">{notifications.map(n => <article key={n._id} className={`mn-notification ${n.read ? '' : 'mn-unread'}`}><span className="mn-badge mn-neutral">{n.read ? 'Read' : 'Unread'}</span><h2>{n.title}</h2><p>{n.message}</p><p className="mn-muted">{new Date(n.createdAt).toLocaleString()}</p><Link className="mn-text-button" to={`/pharmacy/${n.pharmacy}`}>View pharmacy</Link>{!n.read && <button type="button" className="mn-button mn-secondary" disabled={busy === n._id} onClick={() => onRead(n._id)}>{busy === n._id ? 'Saving...' : 'Mark as read'}</button>}</article>)}</div>;
}
export default function Notifications() {
  const alerts = useAlerts();
  const [busy, setBusy] = useState(''), [error, setError] = useState('');
  async function read(id) {
    setBusy(id); setError('');
    try { await alertApi.markRead(id); await alerts.refresh(); }
    catch (e) { setError(e.response?.data?.message || 'Unable to mark notification as read.'); }
    finally { setBusy(''); }
  }
  return <main className="mn-app"><header className="mn-site-header"><Link className="mn-logo" to="/"><span><Icon name="cross" /></span>MediNear</Link><NotificationBell /></header><section className="mn-inbox"><Link className="mn-back-link" to="/">Back to Search</Link><h1>Notifications</h1>{(error || alerts.notificationError) && <div role="alert"><p>{error || alerts.notificationError}</p><button className="mn-button mn-secondary" onClick={() => { setError(''); alerts.refresh(true); }}>Retry</button></div>}{alerts.notificationLoading ? <p role="status">Loading notifications...</p> : !alerts.notificationError && <NotificationsView notifications={alerts.notifications} busy={busy} onRead={read} />}</section></main>;
}
