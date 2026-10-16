import { useEffect, useState } from 'react';
import { createToastStore } from '../utils/toastStore';
import '../styles/Toast.css';

import { ToastContext } from '../auth/ToastContext';

export function ToastContainer({ toasts, onDismiss }) {
  const symbols = { success: '\u2713', error: '\u26a0', info: '\u2139' };
  return <div className="mn-toasts" aria-label="Notifications">
    {toasts.map(toast => <div key={toast.id} className={`mn-toast mn-toast-${toast.type}`}>
      <div role="status" aria-live="polite" aria-atomic="true">
        <span className="mn-toast-icon" aria-hidden="true">{symbols[toast.type]}</span>
        <span className="mn-sr-only">{`${toast.type}: `}</span>{toast.message}
      </div>
      <button type="button" aria-label="Dismiss notification" onClick={() => onDismiss(toast.id)}>&times;</button>
    </div>)}
  </div>;
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [store] = useState(() => createToastStore(setToasts));
  useEffect(() => () => store.clear(), [store]);
  return <ToastContext.Provider value={store}>{children}<ToastContainer toasts={toasts} onDismiss={store.dismiss} /></ToastContext.Provider>;
}
