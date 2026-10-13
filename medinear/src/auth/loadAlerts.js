export async function loadAlerts(api) {
  // Independent results: a notification error must not block subscription status.
  const [subscriptions, notifications] = await Promise.allSettled([api.subscriptions(), api.notifications()]);
  return { subscriptions, notifications };
}
export function alertLoadError(result, fallback) {
  return result.status === 'fulfilled' ? '' : result.reason?.response?.data?.message || fallback;
}
