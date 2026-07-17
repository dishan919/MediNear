import { NavLink } from "react-router-dom";

function BottomNav() {
  return (
    <nav className="bottom-nav">
      <NavLink
        to="/"
        className={({ isActive }) =>
          isActive ? "active" : ""
        }
      >
        Home
      </NavLink>

      <NavLink
        to="/favorites"
        className={({ isActive }) =>
          isActive ? "active" : ""
        }
      >
        Favorites
      </NavLink>

      <NavLink
        to="/cart"
        className={({ isActive }) =>
          isActive ? "active" : ""
        }
      >
        Cart
      </NavLink>

      <NavLink
        to="/orders"
        className={({ isActive }) =>
          isActive ? "active" : ""
        }
      >
        Orders
      </NavLink>

      <NavLink
        to="/profile"
        className={({ isActive }) =>
          isActive ? "active" : ""
        }
      >
        Profile
      </NavLink>
    </nav>
  );
}

export default BottomNav;