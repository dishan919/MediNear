import { useEffect, useMemo, useState } from "react";
import api from "../api/api";
import PharmacyCard from "../components/PharmacyCard";
import "../styles/Home.css";

function Home() {
  const [pharmacies, setPharmacies] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [showOpenOnly, setShowOpenOnly] = useState(false);
  const [show24HoursOnly, setShow24HoursOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchPharmacies = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/pharmacies");

      const pharmacyList = response.data.pharmacies || [];

      setPharmacies(pharmacyList);
    } catch (requestError) {
      console.error("Pharmacy fetch error:", requestError);

      setError(
        requestError.response?.data?.message ||
          "Unable to load pharmacies. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPharmacies();
  }, []);

  const filteredPharmacies = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();

    return pharmacies.filter((pharmacy) => {
      const matchesSearch =
        pharmacy.name
          ?.toLowerCase()
          .includes(normalizedSearch) ||
        pharmacy.address
          ?.toLowerCase()
          .includes(normalizedSearch) ||
        pharmacy.district
          ?.toLowerCase()
          .includes(normalizedSearch);

      const matchesOpenStatus =
        !showOpenOnly || pharmacy.isOpen;

      const matches24Hours =
        !show24HoursOnly || pharmacy.open24Hours;

      return (
        matchesSearch &&
        matchesOpenStatus &&
        matches24Hours
      );
    });
  }, [
    pharmacies,
    searchText,
    showOpenOnly,
    show24HoursOnly,
  ]);

  return (
    <main className="home-page">
      <section className="hero-section">
        <div className="hero-content">
          <p className="hero-label">MediNear</p>

          <h1>Find a pharmacy near you</h1>

          <p className="hero-description">
            Search pharmacies by name, address, or district.
          </p>

          <div className="search-container">
            <input
              type="search"
              placeholder="Search pharmacy or location..."
              value={searchText}
              onChange={(event) =>
                setSearchText(event.target.value)
              }
              className="search-input"
            />
          </div>

          <div className="filter-container">
            <label className="filter-option">
              <input
                type="checkbox"
                checked={showOpenOnly}
                onChange={(event) =>
                  setShowOpenOnly(event.target.checked)
                }
              />

              Open now
            </label>

            <label className="filter-option">
              <input
                type="checkbox"
                checked={show24HoursOnly}
                onChange={(event) =>
                  setShow24HoursOnly(event.target.checked)
                }
              />

              Open 24 hours
            </label>
          </div>
        </div>
      </section>

      <section className="pharmacy-section">
        <div className="section-header">
          <div>
            <p className="section-label">
              Available pharmacies
            </p>

            <h2>
              Nearby pharmacies
            </h2>
          </div>

          {!loading && !error && (
            <p className="result-count">
              {filteredPharmacies.length} result
              {filteredPharmacies.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {loading && (
          <div className="message-box">
            <div className="loading-spinner"></div>
            <p>Loading pharmacies...</p>
          </div>
        )}

        {!loading && error && (
          <div className="message-box error-box">
            <p>{error}</p>

            <button
              type="button"
              onClick={fetchPharmacies}
              className="retry-button"
            >
              Try again
            </button>
          </div>
        )}

        {!loading &&
          !error &&
          filteredPharmacies.length === 0 && (
            <div className="message-box">
              <p>No pharmacies found.</p>

              <button
                type="button"
                className="clear-button"
                onClick={() => {
                  setSearchText("");
                  setShowOpenOnly(false);
                  setShow24HoursOnly(false);
                }}
              >
                Clear filters
              </button>
            </div>
          )}

        {!loading &&
          !error &&
          filteredPharmacies.length > 0 && (
            <div className="pharmacy-grid">
              {filteredPharmacies.map((pharmacy) => (
                <PharmacyCard
                  key={pharmacy._id}
                  pharmacy={pharmacy}
                />
              ))}
            </div>
          )}
      </section>
    </main>
  );
}

export default Home;