import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/api";
import BottomNav from "../components/BottomNav";

function Favorites() {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchFavorites() {
      try {
        const token = localStorage.getItem("token");

        const response = await api.get(
          "/users/favorites",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        setFavorites(response.data.favorites || []);
      } catch (error) {
        console.error("Favorites error:", error);

        setError(
          error.response?.data?.message ||
            "Unable to load favorites."
        );
      } finally {
        setLoading(false);
      }
    }

    fetchFavorites();
  }, []);

  async function removeFavorite(pharmacyId) {
    try {
      const token = localStorage.getItem("token");

      await api.delete(
        `/users/favorites/${pharmacyId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setFavorites((currentFavorites) =>
        currentFavorites.filter(
          (pharmacy) => pharmacy._id !== pharmacyId
        )
      );
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "Unable to remove favorite."
      );
    }
  }

  async function clearAllFavorites() {
    const confirmed = window.confirm(
      "Are you sure you want to remove all favorites?"
    );

    if (!confirmed) {
      return;
    }

    try {
      const token = localStorage.getItem("token");

      await api.delete("/users/favorites", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setFavorites([]);
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "Unable to clear favorites."
      );
    }
  }

  if (loading) {
    return (
      <div className="page">
        <p>Loading favorites...</p>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="page">
      <header className="simple-header favorite-header">
        <div>
          <h1>Favorites</h1>
          <p>Your saved pharmacies</p>
        </div>

        {favorites.length > 0 && (
          <button
            type="button"
            className="clear-button"
            onClick={clearAllFavorites}
          >
            Clear All
          </button>
        )}
      </header>

      {error && (
        <p style={{ color: "red" }}>{error}</p>
      )}

      {favorites.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">♡</div>

          <h2>No favorites yet</h2>

          <p>
            Add pharmacies from the home page to see them
            here.
          </p>

          <Link to="/" className="primary-link-button">
            Find Pharmacies
          </Link>
        </div>
      ) : (
        <div className="pharmacy-list">
          {favorites.map((pharmacy) => (
            <div
              className="pharmacy-card"
              key={pharmacy._id}
            >
              <div className="pharmacy-icon">+</div>

              <div className="pharmacy-info">
                <h3>{pharmacy.name}</h3>

                <p>📍 {pharmacy.address}</p>

                <p>District: {pharmacy.district}</p>

                <p>📞 {pharmacy.phone}</p>

                <span
                  className={
                    pharmacy.isOpen
                      ? "status open"
                      : "status closed"
                  }
                >
                  {pharmacy.isOpen ? "Open" : "Closed"}
                </span>
              </div>

              <div className="card-actions">
                <button
                  type="button"
                  className="remove-button"
                  onClick={() =>
                    removeFavorite(pharmacy._id)
                  }
                >
                  Remove
                </button>

                <Link
                  className="view-button"
                  to={`/pharmacy/${pharmacy._id}`}
                >
                  View
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <BottomNav />
    </div>
  );
}

export default Favorites;