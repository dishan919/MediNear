// Favorites always come from the authenticated account on the server.
export function favoritesService(api, storage) {
  const config = signal => ({ headers: { Authorization: `Bearer ${storage.getItem('token')}` }, ...(signal ? { signal } : {}) });
  return {
    async list(signal) { return (await api.get('/users/favorites', config(signal))).data.favorites || []; },
    async setSaved(pharmacyId, saved) {
      const path = `/users/favorites/${pharmacyId}`;
      const response = saved ? await api.post(path, {}, config()) : await api.delete(path, config());
      return response.data;
    },
  };
}
