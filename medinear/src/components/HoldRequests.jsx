import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../auth/ToastContext';
import api from '../api/api';
import { HOLD_STATUSES, holdService, createHoldRunner, holdError, holdToast } from '../utils/holds';
import '../styles/Holds.css';
export function HoldRequestsView({ owner, pharmacyId, loading, error, actionError, data, active, onRetry, onAction, onPage }) {
  const title = owner ? 'Medicine Hold Requests' : 'My Hold Requests';
  return <section className={owner ? 'mn-owner-panel mn-holds' : 'mn-holds'} id={owner ? 'owner-hold-requests' : 'my-hold-requests'} aria-label={title}><h2>{title}</h2>
    {owner && !pharmacyId ? <p>Select or create a pharmacy to view hold requests.</p> : loading ? <p role="status">Loading hold requests...</p> : error ? <div role="alert"><p>{error}</p><button type="button" className="mn-button mn-secondary" onClick={onRetry}>Retry hold requests</button></div> : data && <>
      <button type="button" className="mn-text-button" disabled={!!active} onClick={onRetry}>Refresh hold requests</button>
      {actionError && <p className="mn-inline-error" role="alert">{actionError}</p>}
      {!data.requests.length && <p>{owner ? 'No medicine hold requests yet.' : 'No hold requests yet.'}</p>}
      <ul className="mn-hold-list">{data.requests.map(request => <li key={request._id}>
        <h3>{request.medicineName}</h3><p>{owner ? request.customerName : request.pharmacyName}</p><p>Quantity: {request.quantity}</p><p><span className="mn-badge">{request.status[0].toUpperCase() + request.status.slice(1)}</span></p><p>{HOLD_STATUSES[request.status]}</p><time dateTime={request.createdAt}>{new Date(request.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Colombo' })}</time>
        {request.status === 'pending' && <div className="mn-hold-actions">{(owner ? ['accept', 'reject'] : ['cancel']).map(action => <button type="button" className={`mn-button ${action === 'accept' ? 'mn-primary' : 'mn-secondary'}`} key={action} disabled={!!active} onClick={() => onAction(request._id, action)}>{active?.id === request._id && active?.action === action ? { accept: 'Accepting...', reject: 'Rejecting...', cancel: 'Cancelling...' }[action] : { accept: 'Accept', reject: 'Reject', cancel: 'Cancel Request' }[action]}</button>)}</div>}
      </li>)}</ul>
      {(data.page > 1 || data.hasMore) && <nav className="mn-hold-actions" aria-label="Hold request pages"><button type="button" className="mn-button mn-secondary" disabled={!!active || data.page <= 1} onClick={() => onPage(data.page - 1)}>Previous requests</button><span>Page {data.page}</span><button type="button" className="mn-button mn-secondary" disabled={!!active || !data.hasMore} onClick={() => onPage(data.page + 1)}>Next requests</button></nav>}
    </>}
  </section>;
}
function HoldRequestsSession({ owner, pharmacyId, onAccepted }) {
  const { showToast } = useToast();
  const [service] = useState(() => holdService(api, () => localStorage.getItem('token'))), [runner] = useState(createHoldRunner);
  const [data, setData] = useState(null), [loading, setLoading] = useState(!owner || !!pharmacyId), [error, setError] = useState(''), [actionError, setActionError] = useState(''), [active, setActive] = useState(null), [page, setPage] = useState(1), [refresh, setRefresh] = useState(0);
  useEffect(() => () => runner.dispose(), [runner]);
  useEffect(() => {
    if (owner && !pharmacyId) return;
    const controller = new AbortController(); setLoading(true); setError('');
    service.list(owner ? pharmacyId : null, page, controller.signal).then(result => { if (!controller.signal.aborted) setData(result); }).catch(() => { if (!controller.signal.aborted) setError('Unable to load hold requests. Please try again.'); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [service, owner, pharmacyId, page, refresh]);
  function action(id, kind) {
    runner.run(signal => service.action(pharmacyId, id, kind, signal), {
      busy(value) { setActive(value ? { id, action: kind } : null); },
      success(request) { setData(current => ({ ...current, requests: current.requests.map(item => item._id === id ? { ...item, status: request.status } : item) })); setActionError(''); showToast(holdToast(kind)); if (kind === 'accept') onAccepted?.(); },
      error(e) { setActionError(holdError(e)); },
    });
  }
  return <HoldRequestsView owner={owner} pharmacyId={pharmacyId} data={data} loading={loading} error={error} actionError={actionError} active={active} onRetry={() => { setActionError(''); setRefresh(value => value + 1); }} onAction={action} onPage={next => { setLoading(true); setPage(next); }} />;
}
export default function HoldRequests(props) { const { user } = useAuth() || {}; return <HoldRequestsSession key={`${props.owner}:${props.pharmacyId || 'mine'}:${user?.id || user?._id}`} {...props} />; }
