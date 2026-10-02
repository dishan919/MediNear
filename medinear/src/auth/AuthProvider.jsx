import { useEffect, useState } from "react";
import api from "../api/api";
import { checkSession, clearSession, saveSession } from "./session";

import { AuthContext } from "./AuthContext";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    checkSession(api, localStorage).then((currentUser) => {
      if (active) setUser(currentUser);
    }).catch(() => {
      if (active) setError(true);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [attempt]);

  function login(session) {
    setUser(saveSession(localStorage, session));
  }

  function logout() {
    clearSession(localStorage);
    setUser(null);
  }

  if (loading) return <div role="status" style={{ padding: "30px" }}>Checking your session...</div>;
  if (error) return (
    <div role="alert" style={{ padding: "30px" }}>
      <p>Unable to check your session. Please try again.</p>
      <button onClick={() => {
        setError(false);
        setLoading(true);
        setAttempt((current) => current + 1);
      }}>Retry</button>
    </div>
  );

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}
