import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import ProtectedRoute from "./components/ProtectedRoute";
import GuestRoute from "./components/GuestRoute";
import { AuthProvider } from "./auth/AuthProvider";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import Favorites from "./pages/Favorites";
import Orders from "./pages/Orders";
import Profile from "./pages/Profile";
import PharmacyDetails from "./pages/PharmacyDetails";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import OrderSuccess from "./pages/orderSuccess";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route
            path="/login"
            element={
              <GuestRoute><Login /></GuestRoute>
            }
          />

          <Route
            path="/register"
            element={
              <GuestRoute><Register /></GuestRoute>
            }
          />

          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Home />} />

            <Route
              path="/favorites"
              element={<Favorites />}
            />

            <Route
              path="/orders"
              element={<Orders />}
            />

            <Route
              path="/profile"
              element={<Profile />}
            />

            <Route
              path="/cart"
              element={<Cart />}
            />

            <Route
              path="/checkout"
              element={<Checkout />}
            />

            <Route
              path="/pharmacy/:id"
              element={<PharmacyDetails />}
            />

            <Route
              path="/order-success/:orderId"
              element={<OrderSuccess />}
            />
          </Route>

          <Route
            path="*"
            element={<Navigate to="/" replace />}
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
