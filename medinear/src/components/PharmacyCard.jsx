import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/api";
import "../styles/PharmacyCard.css";

function PharmacyCard({
  pharmacy,
  initiallyFavorite = false,
  onFavoriteChange,
  onViewMap,
  selected,
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
    <article className="pharmacy-card" style={selected ? { outline: "3px solid #047857" } : undefined}>
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
          {pharmacy.openStatus || (isOpen === null ? "Hours unavailable" : isOpen ? "Open" : "Closed")}
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
        <Link to={`/pharmacy/${_id}`}>View medicines and pharmacy details</Link>

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
          {open24Hours ? "Open 24 hours" : pharmacy.hoursToday || "Hours unavailable"} ({pharmacy.timezone || "Asia/Colombo"})
        </p>

        {pharmacy.medicines?.map(m => <p key={m._id}>{m.name}: {m.availability}{m.price !== undefined ? ` ? LKR ${m.price}` : ""}</p>)}
        <p>{pharmacy.distance == null ? "Distance unavailable" : `${pharmacy.distance.toFixed(1)} km`}</p>
        {pharmacy.rankingReason && <p>{pharmacy.rank}. {pharmacy.rankingReason}</p>}
        {onViewMap && <button type="button" className="direction-button" onClick={() => onViewMap(_id)}>View on Map</button>}
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