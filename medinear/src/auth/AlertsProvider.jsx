import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { AlertsContext } from './AlertsContext';
import { alertApi } from '../api/alerts';
import { loadAlerts, alertLoadError } from './loadAlerts';
export function AlertsProvider({ children }) {
  const { user } = useAuth();
  const currentUser = useRef(user);
  const sequence = useRef(0);
  currentUser.current = user;
  const [subscriptions, setSubscriptions] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notificationError, setNotificationError] = useState('');
  const [notificationLoading, setNotificationLoading] = useState(true);
  const refresh = useCallback(async (showLoading = false) => {
    if (user?.role !== 'customer') return;
    const request = ++sequence.current;
    if (showLoading === true) { setLoading(true); setNotificationLoading(true); }
    const result = await loadAlerts(alertApi);
    if (currentUser.current !== user || request !== sequence.current) return;
    if (result.subscriptions.status === 'fulfilled') setSubscriptions(result.subscriptions.value);
    if (result.notifications.status === 'fulfilled') {
      setNotifications(result.notifications.value.notifications);
      setUnreadCount(result.notifications.value.unreadCount);
    }
    setError(alertLoadError(result.subscriptions, 'Unable to load alert status. Please try again.'));
    setNotificationError(alertLoadError(result.notifications, 'Unable to load notifications. Please try again.'));
    setLoading(false); setNotificationLoading(false);
  }, [user]);
  useEffect(() => {
    if (user?.role !== 'customer') { setSubscriptions([]); setNotifications([]); setUnreadCount(0); setLoading(false); setNotificationLoading(false); setError(''); setNotificationError(''); return; }
    setLoading(true); setNotificationLoading(true); refresh();
    const timer = setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [user, refresh]);
  return <AlertsContext.Provider value={{ subscriptions, notifications, unreadCount, loading, error, notificationError, notificationLoading, refresh }}>{children}</AlertsContext.Provider>;
}
