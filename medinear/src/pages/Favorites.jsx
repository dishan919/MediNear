import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import BottomNav from "../components/BottomNav";

function Favorites() {
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    const savedFavorites =
      JSON.parse(localStorage.getItem("favorites")) || [];

    setFavorites(savedFavorites);
  }, []);

  function removeFavorite(pharmacyId) {
    const updatedFavorites = favorites.filter(
      (pharmacy) => pharmacy.id !== pharmacyId
    );

    setFavorites(updatedFavorites);

    localStorage.setItem(
      "favorites",
      JSON.stringify(updatedFavorites)
    );
  }

  function clearAllFavorites() {
    const confirmed = window.confirm(
      "Are you sure you want to remove all favorites?"
    );

    if (!confirmed) {
      return;
    }

    setFavorites([]);
    localStorage.removeItem("favorites");
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
            className="clear-button"
            onClick={clearAllFavorites}
          >
            Clear All
          </button>
        )}
      </header>

      {favorites.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">♡</div>

          <h2>No favorites yet</h2>

          <p>
            Add pharmacies from the home page to see them here.
          </p>

          <Link to="/" className="primary-link-button">
            Find Pharmacies
          </Link>
        </div>
      ) : (
        <div className="pharmacy-list">
          {favorites.map((pharmacy) => (
            <div className="pharmacy-card" key={pharmacy.id}>
              <div className="pharmacy-icon">+</div>

              <div className="pharmacy-info">
                <h3>{pharmacy.name}</h3>
                <p>{pharmacy.distance} away</p>
                <p>⭐ {pharmacy.rating}</p>

                <span
                  className={
                    pharmacy.status === "Open"
                      ? "status open"
                      : "status closed"
                  }
                >
                  {pharmacy.status}
                </span>
              </div>

              <div className="card-actions">
                <button
                  className="remove-button"
                  onClick={() =>
                    removeFavorite(pharmacy.id)
                  }
                >
                  Remove
                </button>

                <Link
                  className="view-button"
                  to={`/pharmacy/${pharmacy.id}`}
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