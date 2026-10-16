export const TOAST_DURATION = 3000;
export const MAX_TOASTS = 3;

// Each notification owns exactly one timer; dismiss, eviction and teardown clear it.
export function createToastStore(notify, clock = globalThis) {
  let items = [], nextId = 0;
  const timers = new Map();
  function dismiss(id) {
    if (!timers.has(id)) return;
    clock.clearTimeout(timers.get(id)); timers.delete(id);
    items = items.filter(item => item.id !== id); notify(items);
  }
  return {
    showToast({ message, type = 'info' }) {
      if (!message) return;
      const id = ++nextId;
      if (items.length >= MAX_TOASTS) dismiss(items[0].id);
      items = [...items, { id, message, type: ['success', 'error', 'info'].includes(type) ? type : 'info' }];
      timers.set(id, clock.setTimeout(() => dismiss(id), TOAST_DURATION));
      notify(items);
      return id;
    },
    dismiss,
    clear() {
      for (const timer of timers.values()) clock.clearTimeout(timer);
      timers.clear(); items = [];
    },
  };
}
