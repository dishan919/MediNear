import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

function PharmacyDetails() {
  const { id } = useParams();

  const pharmacies = [
    {
      id: 1,
      name: "City Pharmacy",
      rating: 4.5,
      address: "No. 25, Main Street, Colombo",
      distance: "1.2 km",
      openingHours: "8:00 AM - 10:00 PM",
      phone: "+94 11 234 5678",
      delivery: "Available",
      status: "Open",
    },
    {
      id: 2,
      name: "Health Care Pharmacy",
      rating: 4.2,
      address: "No. 15, Galle Road, Colombo",
      distance: "2.4 km",
      openingHours: "9:00 AM - 9:00 PM",
      phone: "+94 11 456 7890",
      delivery: "Available",
      status: "Open",
    },
    {
      id: 3,
      name: "Medi Plus",
      rating: 4.7,
      address: "No. 44, Hospital Road, Colombo",
      distance: "3.1 km",
      openingHours: "8:30 AM - 8:00 PM",
      phone: "+94 11 987 6543",
      delivery: "Not Available",
      status: "Closed",
    },
  ];

  const medicines = [
    {
      id: 101,
      pharmacyId: 1,
      name: "Panadol",
      category: "Pain Relief",
      dosage: "500mg",
      price: 120,
      stock: 25,
      prescriptionRequired: false,
    },
    {
      id: 102,
      pharmacyId: 1,
      name: "Vitamin C",
      category: "Vitamins",
      dosage: "1000mg",
      price: 750,
      stock: 15,
      prescriptionRequired: false,
    },
    {
      id: 103,
      pharmacyId: 1,
      name: "Amoxicillin",
      category: "Antibiotic",
      dosage: "500mg",
      price: 980,
      stock: 10,
      prescriptionRequired: true,
    },
    {
      id: 104,
      pharmacyId: 1,
      name: "Cetirizine",
      category: "Allergy Relief",
      dosage: "10mg",
      price: 180,
      stock: 20,
      prescriptionRequired: false,
    },
    {
      id: 201,
      pharmacyId: 2,
      name: "Paracetamol",
      category: "Pain Relief",
      dosage: "500mg",
      price: 100,
      stock: 30,
      prescriptionRequired: false,
    },
    {
      id: 202,
      pharmacyId: 2,
      name: "Calcium Tablets",
      category: "Supplements",
      dosage: "600mg",
      price: 850,
      stock: 12,
      prescriptionRequired: false,
    },
    {
      id: 301,
      pharmacyId: 3,
      name: "Cough Syrup",
      category: "Cold and Flu",
      dosage: "100ml",
      price: 520,
      stock: 8,
      prescriptionRequired: false,
    },
  ];

  const pharmacy = pharmacies.find(
    (item) => item.id === Number(id)
  );

  const pharmacyMedicines = medicines.filter(
    (medicine) => medicine.pharmacyId === Number(id)
  );

  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    updateCartCount();
  }, []);

  function updateCartCount() {
    const savedCart =
      JSON.parse(localStorage.getItem("cart")) || [];

    const totalQuantity = savedCart.reduce(
      (total, item) => total + item.quantity,
      0
    );

    setCartCount(totalQuantity);
  }

  function addToCart(medicine) {
    const savedCart =
      JSON.parse(localStorage.getItem("cart")) || [];

    const existingItem = savedCart.find(
      (item) => item.id === medicine.id
    );

    let updatedCart;

    if (existingItem) {
      updatedCart = savedCart.map((item) =>
        item.id === medicine.id
          ? {
              ...item,
              quantity: item.quantity + 1,
            }
          : item
      );
    } else {
      updatedCart = [
        ...savedCart,
        {
          ...medicine,
          pharmacyName: pharmacy.name,
          quantity: 1,
        },
      ];
    }

    localStorage.setItem(
      "cart",
      JSON.stringify(updatedCart)
    );

    updateCartCount();

    alert(`${medicine.name} added to cart`);
  }

  if (!pharmacy) {
    return (
      <div className="page">
        <div className="empty-state">
          <h2>Pharmacy not found</h2>

          <Link to="/" className="primary-link-button">
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="details-top-bar">
        <Link to="/" className="back-link">
          ← Back
        </Link>

        <Link to="/cart" className="cart-link">
          Cart ({cartCount})
        </Link>
      </div>

      <div className="details-banner">
        <div className="large-pharmacy-icon">+</div>

        <h1>{pharmacy.name}</h1>

        <p>⭐ {pharmacy.rating} rating</p>

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

      <div className="details-card">
        <h2>Pharmacy Information</h2>

        <p>
          <strong>Address:</strong> {pharmacy.address}
        </p>

        <p>
          <strong>Distance:</strong> {pharmacy.distance}
        </p>

        <p>
          <strong>Opening Hours:</strong>{" "}
          {pharmacy.openingHours}
        </p>

        <p>
          <strong>Phone:</strong> {pharmacy.phone}
        </p>

        <p>
          <strong>Delivery:</strong> {pharmacy.delivery}
        </p>
      </div>

      <div className="action-buttons">
        <a
          href={`tel:${pharmacy.phone}`}
          className="primary-button action-link"
        >
          Call Pharmacy
        </a>

        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            pharmacy.address
          )}`}
          target="_blank"
          rel="noreferrer"
          className="secondary-button action-link"
        >
          Get Directions
        </a>
      </div>

      <section className="medicine-section">
        <div className="section-title">
          <h2>Available Medicines</h2>

          <span>{pharmacyMedicines.length} items</span>
        </div>

        {pharmacyMedicines.length === 0 ? (
          <div className="empty-state">
            <h2>No medicines found</h2>
            <p>This pharmacy has no available medicines.</p>
          </div>
        ) : (
          <div className="medicine-list">
            {pharmacyMedicines.map((medicine) => (
              <div
                className="medicine-card"
                key={medicine.id}
              >
                <div className="medicine-icon">💊</div>

                <div className="medicine-info">
                  <h3>{medicine.name}</h3>

                  <p>{medicine.category}</p>

                  <p>Dosage: {medicine.dosage}</p>

                  <p>Stock: {medicine.stock}</p>

                  {medicine.prescriptionRequired && (
                    <span className="prescription-badge">
                      Prescription Required
                    </span>
                  )}

                  <h4>Rs. {medicine.price}</h4>
                </div>

                <button
                  className="add-cart-button"
                  onClick={() => addToCart(medicine)}
                  disabled={medicine.stock === 0}
                >
                  {medicine.stock === 0
                    ? "Out of Stock"
                    : "Add to Cart"}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default PharmacyDetails;