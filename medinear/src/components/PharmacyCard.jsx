import "../styles/PharmacyCard.css";

function PharmacyCard({ pharmacy }) {
  const {
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

  const handleCall = () => {
    window.location.href = `tel:${phone}`;
  };

  const handleDirections = () => {
    const mapsURL = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

    window.open(mapsURL, "_blank", "noopener,noreferrer");
  };

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
            isOpen ? "status-open" : "status-closed"
          }`}
        >
          {isOpen ? "Open" : "Closed"}
        </span>
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