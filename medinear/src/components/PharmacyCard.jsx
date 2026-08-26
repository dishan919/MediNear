import { useEffect, useState } from "react";
import api from "../api/api";
import "../styles/PharmacyCard.css";

function PharmacyCard({
  pharmacy,
  initiallyFavorite = false,
  onFavoriteChange,
}) {
  const {
    _id,
    name,
    address,
    district,
    phone,
    open24Hours,
    isOpen,
    image,
    latitude,
    longitude,
  } = pharmacy;

  const [isFavorite, setIsFavorite] =
    useState(initiallyFavorite);

  const [favoriteLoading, setFavoriteLoading] =
    useState(false);

  useEffect(() => {
    setIsFavorite(initiallyFavorite);
  }, [initiallyFavorite]);

  const handleCall = () => {
    window.location.href = `tel:${phone}`;
  };

  const handleDirections = () => {
    const mapsURL =
      `https://www.google.com/maps/search/?api=1` +
      `&query=${latitude},${longitude}`;

    window.open(
      mapsURL,
      "_blank",
      "noopener,noreferrer"
    );
  };

  async function handleFavorite() {
    try {
      setFavoriteLoading(true);

      const token = localStorage.getItem("token");

      if (isFavorite) {
        await api.delete(
          `/users/favorites/${_id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
      } else {
        await api.post(
          `/users/favorites/${_id}`,
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
      }

      const newFavoriteStatus = !isFavorite;

      setIsFavorite(newFavoriteStatus);

      if (onFavoriteChange) {
        onFavoriteChange(
          _id,
          newFavoriteStatus
        );
      }
    } catch (error) {
      console.error("Favorite update error:", error);

      alert(
        error.response?.data?.message ||
          "Unable to update favorite."
      );
    } finally {
      setFavoriteLoading(false);
    }
  }

  return (
    <article className="pharmacy-card">
      <div className="pharmacy-image-container">
        {image ? (
          <img
            src={image}
            alt={name}
            className="pharmacy-image"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <div className="pharmacy-placeholder">
            <span>💊</span>
          </div>
        )}

        <span
          className={`status-badge ${
            isOpen
              ? "status-open"
              : "status-closed"
          }`}
        >
          {isOpen ? "Open" : "Closed"}
        </span>

        <button
          type="button"
          className="favorite-button"
          onClick={handleFavorite}
          disabled={favoriteLoading}
          aria-label={
            isFavorite
              ? "Remove from favorites"
              : "Add to favorites"
          }
        >
          {isFavorite ? "♥" : "♡"}
        </button>
      </div>

      <div className="pharmacy-content">
        <h2 className="pharmacy-name">{name}</h2>

        <p className="pharmacy-address">
          📍 {address}
        </p>

        <p className="pharmacy-district">
          District: {district}
        </p>

        <p className="pharmacy-phone">
          📞 {phone}
        </p>

        <p className="pharmacy-hours">
          {open24Hours
            ? "🕒 Open 24 hours"
            : "🕒 Regular opening hours"}
        </p>

        <div className="pharmacy-actions">
          <button
            type="button"
            className="call-button"
            onClick={handleCall}
          >
            Call
          </button>

          <button
            type="button"
            className="direction-button"
            onClick={handleDirections}
          >
            Directions
          </button>
        </div>
      </div>
    </article>
  );
}

export default PharmacyCard;