import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

function Checkout() {
  const navigate = useNavigate();

  const [cart, setCart] = useState([]);

  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    address: "",
    city: "",
    deliveryMethod: "standard",
    paymentMethod: "cash",
    notes: "",
  });

  const [error, setError] = useState("");

  useEffect(() => {
    const savedCart =
      JSON.parse(localStorage.getItem("cart")) || [];

    setCart(savedCart);
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((previousData) => ({
      ...previousData,
      [name]: value,
    }));
  }

  const subtotal = cart.reduce(
    (total, item) =>
      total + item.price * item.quantity,
    0
  );

  function getDeliveryFee() {
    if (cart.length === 0) {
      return 0;
    }

    if (formData.deliveryMethod === "express") {
      return 500;
    }

    if (formData.deliveryMethod === "pickup") {
      return 0;
    }

    return 250;
  }

  const deliveryFee = getDeliveryFee();
  const total = subtotal + deliveryFee;

  function validateForm() {
    if (
      !formData.fullName.trim() ||
      !formData.phone.trim() ||
      !formData.address.trim() ||
      !formData.city.trim()
    ) {
      setError("Please fill in all required fields.");
      return false;
    }

    if (formData.phone.trim().length < 9) {
      setError("Please enter a valid phone number.");
      return false;
    }

    setError("");
    return true;
  }

  function placeOrder(event) {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (cart.length === 0) {
      setError("Your cart is empty.");
      return;
    }

    const savedOrders =
      JSON.parse(localStorage.getItem("orders")) || [];

    const newOrder = {
      id: `ORD${Date.now()}`,
      customer: {
        fullName: formData.fullName,
        phone: formData.phone,
        address: formData.address,
        city: formData.city,
      },
      items: cart,
      deliveryMethod: formData.deliveryMethod,
      paymentMethod: formData.paymentMethod,
      notes: formData.notes,
      subtotal,
      deliveryFee,
      total,
      status: "Order Placed",
      orderDate: new Date().toLocaleString(),
    };

    const updatedOrders = [newOrder, ...savedOrders];

    localStorage.setItem(
      "orders",
      JSON.stringify(updatedOrders)
    );

    localStorage.removeItem("cart");

    navigate(`/order-success/${newOrder.id}`);
  }

  if (cart.length === 0) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="empty-icon">🛒</div>

          <h2>Your cart is empty</h2>

          <p>Add medicines before going to checkout.</p>

          <Link to="/" className="primary-link-button">
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="checkout-top-bar">
        <Link to="/cart" className="back-link">
          ← Back to Cart
        </Link>

        <h1>Checkout</h1>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <form onSubmit={placeOrder}>
        <section className="checkout-section">
          <h2>Delivery Information</h2>

          <div className="form-group">
            <label htmlFor="fullName">
              Full Name
            </label>

            <input
              id="fullName"
              type="text"
              name="fullName"
              placeholder="Enter your full name"
              value={formData.fullName}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="phone">
              Phone Number
            </label>

            <input
              id="phone"
              type="tel"
              name="phone"
              placeholder="+94 77 123 4567"
              value={formData.phone}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="address">
              Delivery Address
            </label>

            <textarea
              id="address"
              name="address"
              placeholder="Enter your delivery address"
              value={formData.address}
              onChange={handleChange}
              rows="3"
            />
          </div>

          <div className="form-group">
            <label htmlFor="city">
              City
            </label>

            <input
              id="city"
              type="text"
              name="city"
              placeholder="Enter your city"
              value={formData.city}
              onChange={handleChange}
            />
          </div>
        </section>

        <section className="checkout-section">
          <h2>Delivery Method</h2>

          <label className="radio-option">
            <input
              type="radio"
              name="deliveryMethod"
              value="standard"
              checked={
                formData.deliveryMethod === "standard"
              }
              onChange={handleChange}
            />

            <div>
              <strong>Standard Delivery</strong>
              <p>Estimated 45 - 60 minutes</p>
              <span>Rs. 250</span>
            </div>
          </label>

          <label className="radio-option">
            <input
              type="radio"
              name="deliveryMethod"
              value="express"
              checked={
                formData.deliveryMethod === "express"
              }
              onChange={handleChange}
            />

            <div>
              <strong>Express Delivery</strong>
              <p>Estimated 20 - 30 minutes</p>
              <span>Rs. 500</span>
            </div>
          </label>

          <label className="radio-option">
            <input
              type="radio"
              name="deliveryMethod"
              value="pickup"
              checked={
                formData.deliveryMethod === "pickup"
              }
              onChange={handleChange}
            />

            <div>
              <strong>Pharmacy Pickup</strong>
              <p>Collect the order from the pharmacy</p>
              <span>Free</span>
            </div>
          </label>
        </section>

        <section className="checkout-section">
          <h2>Payment Method</h2>

          <label className="radio-option">
            <input
              type="radio"
              name="paymentMethod"
              value="cash"
              checked={
                formData.paymentMethod === "cash"
              }
              onChange={handleChange}
            />

            <div>
              <strong>Cash on Delivery</strong>
              <p>Pay when your order arrives</p>
            </div>
          </label>

          <label className="radio-option">
            <input
              type="radio"
              name="paymentMethod"
              value="card"
              checked={
                formData.paymentMethod === "card"
              }
              onChange={handleChange}
            />

            <div>
              <strong>Credit or Debit Card</strong>
              <p>Online card payment</p>
            </div>
          </label>
        </section>

        <section className="checkout-section">
          <h2>Delivery Notes</h2>

          <div className="form-group">
            <textarea
              name="notes"
              placeholder="Add delivery instructions"
              value={formData.notes}
              onChange={handleChange}
              rows="3"
            />
          </div>
        </section>

        <section className="checkout-section">
          <h2>Order Summary</h2>

          {cart.map((item) => (
            <div
              className="checkout-item"
              key={item.id}
            >
              <div>
                <strong>{item.name}</strong>

                <p>
                  {item.quantity} × Rs. {item.price}
                </p>
              </div>

              <strong>
                Rs. {item.quantity * item.price}
              </strong>
            </div>
          ))}

          <div className="summary-row">
            <span>Subtotal</span>
            <span>Rs. {subtotal}</span>
          </div>

          <div className="summary-row">
            <span>Delivery Fee</span>
            <span>Rs. {deliveryFee}</span>
          </div>

          <div className="summary-row total-row">
            <strong>Total</strong>
            <strong>Rs. {total}</strong>
          </div>
        </section>

        <button
          type="submit"
          className="place-order-button"
        >
          Place Order · Rs. {total}
        </button>
      </form>
    </div>
  );
}

export default Checkout;