import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { getHomeRoute } from "../auth/roles";

export default function GuestRoute({ children }) {
  const { user } = useAuth();
  return user ? <Navigate to={getHomeRoute(user)} replace /> : children;
}
