import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function GuestRoute({ children }) {
  const { user } = useAuth();
  return user ? <Navigate to="/" replace /> : children;
}
