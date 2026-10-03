import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import "../styles/Session.css";
import { getHomeRoute, getUserRole } from "../auth/roles";

function ProtectedRoute({ role }) {
  const { user, logout } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (role && getUserRole(user) !== role) {
    return <Navigate to={getHomeRoute(user)} replace />;
  }

  return <>
    <div className="session-toolbar">
      <button className="session-logout" type="button" onClick={logout}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
          strokeLinejoin="round" aria-hidden="true" focusable="false">
          <path d="M9 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4M14 8l4 4-4 4M8 12h13" />
        </svg>
        <span>Logout</span>
      </button>
    </div>
    <Outlet />
  </>;
}

export default ProtectedRoute;
