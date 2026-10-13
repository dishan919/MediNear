import { Link } from 'react-router-dom';
import { useAlerts } from '../auth/AlertsContext';
import Icon from './Icon';
export default function NotificationBell() {
  const alerts = useAlerts();
  if (!alerts) return null;
  return <Link className="mn-notification-bell" to="/notifications" aria-label={alerts.notificationError ? 'Notifications, count unavailable' : `Notifications, ${alerts.unreadCount} unread`}><Icon name="bell" /><span>Notifications</span>{!alerts.notificationLoading && !alerts.notificationError && alerts.unreadCount > 0 && <strong>{alerts.unreadCount}</strong>}</Link>;
}
