export function clearSession(storage) {
  storage.removeItem("token");
  storage.removeItem("user");
}

export function saveSession(storage, { token, user }) {
  storage.setItem("user", JSON.stringify(user));
  storage.setItem("token", token);
  return user;
}

export async function checkSession(api, storage) {
  const token = storage.getItem("token");
  if (!token) {
    clearSession(storage);
    return null;
  }
  try {
    const response = await api.get("/auth/profile", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.data.success || !response.data.user) {
      throw new Error("Invalid session response");
    }
    storage.setItem("user", JSON.stringify(response.data.user));
    return response.data.user;
  } catch (error) {
    if (error.response?.status === 401) {
      clearSession(storage);
      return null;
    }
    throw error;
  }
}
