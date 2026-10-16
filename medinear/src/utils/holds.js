import { deadlineFields, serverTimeAnchor } from './holdDeadline.js';
export const HOLD_STATUSES = { pending: 'Waiting for pharmacy confirmation.', accepted: 'Confirmed by pharmacy.', rejected: 'Request declined by pharmacy.', cancelled: 'Request cancelled.', expired: 'Hold expired before pickup.', completed: 'Picked up successfully.' };
export const holdToast = action => ({ type: 'success', message: { create: 'Hold request sent.', accept: 'Hold request accepted.', reject: 'Hold request rejected.', cancel: 'Hold request cancelled.', complete: 'Hold marked as collected.' }[action] });
export function quantityError(value, stock) {
  const quantity = typeof value === 'string' && value.trim() ? Number(value) : value;
  if (!Number.isSafeInteger(quantity) || quantity <= 0) return 'Quantity must be a positive whole number.';
  return !Number.isSafeInteger(stock) || quantity > stock ? 'Requested quantity exceeds available stock.' : '';
}
function mutationResponse(response) {
  const item = response.data?.request;
  if (!item || typeof item._id !== 'string' || !Object.hasOwn(HOLD_STATUSES, item.status) || !Number.isSafeInteger(item.quantity) || item.quantity < 1) throw new Error('Invalid hold request response');
  return { _id: item._id, quantity: item.quantity, status: item.status, ...deadlineFields(item), ...serverTimeAnchor(response.data.serverNow) };
}
export function holdService(api, token) {
  const config = signal => ({ signal, headers: { Authorization: `Bearer ${token()}` } });
  return {
    async create(pharmacyId, medicineId, quantity, signal) { return mutationResponse(await api.post(`/pharmacies/${pharmacyId}/hold-requests`, { medicineId, quantity }, config(signal))); },
    async list(pharmacyId, page, signal) {
      const path = pharmacyId ? `/pharmacies/${pharmacyId}/hold-requests` : '/users/hold-requests';
      const data = (await api.get(path, { ...config(signal), params: { page } })).data;
      if (data?.success !== true || !Array.isArray(data.requests) || data.requests.length > 10 || !Number.isSafeInteger(data.page) || data.page < 1 || typeof data.hasMore !== 'boolean') throw new Error('Invalid hold request response');
      const requests = data.requests.map(item => {
        if (!item || typeof item._id !== 'string' || !Object.hasOwn(HOLD_STATUSES, item.status) || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || typeof item.medicineName !== 'string' || typeof item.pharmacyName !== 'string' || typeof item.createdAt !== 'string' || Number.isNaN(Date.parse(item.createdAt)) || (pharmacyId && typeof item.customerName !== 'string')) throw new Error('Invalid hold request response');
        return { _id: item._id, status: item.status, quantity: item.quantity, medicineName: item.medicineName, pharmacyName: item.pharmacyName, createdAt: item.createdAt, ...deadlineFields(item), ...(pharmacyId ? { customerName: item.customerName } : {}) };
      });
      return { requests, page: data.page, hasMore: data.hasMore, ...serverTimeAnchor(data.serverNow) };
    },
    async action(pharmacyId, requestId, action, signal) {
      const path = action === 'cancel' ? `/users/hold-requests/${requestId}/cancel` : `/pharmacies/${pharmacyId}/hold-requests/${requestId}/${action}`;
      return mutationResponse(await api.patch(path, {}, config(signal)));
    },
  };
}
export function createHoldRunner() {
  let pending = false, controller;
  return {
    dispose() { controller?.abort(); },
    async run(action, callbacks) {
      if (pending) return;
      pending = true; controller = new AbortController(); const signal = controller.signal; callbacks.busy(true);
      try { const result = await action(signal); if (!signal.aborted) callbacks.success(result); }
      catch (error) { if (!signal.aborted) callbacks.error(error); }
      finally { pending = false; if (!signal.aborted) callbacks.busy(false); }
    },
  };
}
export function holdError(error) {
  return [400, 404, 409, 503].includes(error.response?.status) && typeof error.response?.data?.message === 'string' ? error.response.data.message : 'Unable to process hold request. Please check your connection and try again.';
}
