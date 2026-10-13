import api from './api';
const options = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
export const alertApi = {
  subscriptions: () => api.get('/restock-subscriptions', options()).then(r => r.data.subscriptions),
  subscribe: (pharmacy, medicine) => api.post('/restock-subscriptions', { pharmacy, medicine }, options()).then(r => r.data.subscription),
  cancel: id => api.delete(`/restock-subscriptions/${id}`, options()),
  notifications: () => api.get('/notifications', options()).then(r => r.data),
  markRead: id => api.patch(`/notifications/${id}/read`, {}, options()),
};
