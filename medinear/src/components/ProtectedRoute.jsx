import { Navigate, Outlet } from "react-router-dom";

function ProtectedRoute() {
  const loggedInUser = localStorage.getItem("loggedInUser");

  if (!loggedInUser) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;