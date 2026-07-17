import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import BottomNav from "../components/BottomNav";


function Cart() {
  const [cart, setCart] = useState([]);

  const deliveryFee = cart.length > 0 ? 250 : 0;

  useEffect(() => {
    const savedCart =
      JSON.parse(localStorage.getItem("cart")) || [];

    setCart(savedCart);
  }, []);

  function saveCart(updatedCart) {
    setCart(updatedCart);

    localStorage.setItem(
      "cart",
      JSON.stringify(updatedCart)
    );
  }

  function increaseQuantity(medicineId) {
    const updatedCart = cart.map((item) =>
      item.id === medicineId
        ? {
            ...item,
            quantity: item.quantity + 1,
          }
        : item
    );

    saveCart(updatedCart);
  }

  function decreaseQuantity(medicineId) {
    const updatedCart = cart
      .map((item) =>
        item.id === medicineId
          ? {
              ...item,
              quantity: item.quantity - 1,
            }
          : item
      )
      .filter((item) => item.quantity > 0);

    saveCart(updatedCart);
  }

  function removeItem(medicineId) {
    const confirmed = window.confirm(
      "Do you want to remove this item?"
    );

    if (!confirmed) {
      return;
    }

    const updatedCart = cart.filter(
      (item) => item.id !== medicineId
    );

    saveCart(updatedCart);
  }

  function clearCart() {
    const confirmed = window.confirm(
      "Do you want to clear the entire cart?"
    );

    if (!confirmed) {
      return;
    }

    setCart([]);
    localStorage.removeItem("cart");
  }

  
  const subtotal = cart.reduce(
    (total, item) =>
      total + item.price * item.quantity,
    0
  );

  const total = subtotal + deliveryFee;

  const totalItems = cart.reduce(
    (totalQuantity, item) =>
      totalQuantity + item.quantity,
    0
  );

  return (
    <div className="page">
      <header className="cart-header">
        <div>
          <h1>My Cart</h1>
          <p>{totalItems} items in your cart</p>
        </div>

        {cart.length > 0 && (
          <button
            className="clear-button"
            onClick={clearCart}
          >
            Clear All
          </button>
        )}
      </header>

      {cart.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🛒</div>

          <h2>Your cart is empty</h2>

          <p>
            Add medicines from a pharmacy to continue.
          </p>

          <Link to="/" className="primary-link-button">
            Find Medicines
          </Link>
        </div>
      ) : (
        <>
          <div className="cart-list">
            {cart.map((item) => (
              <div className="cart-card" key={item.id}>
                <div className="medicine-icon">💊</div>

                <div className="cart-item-info">
                  <h3>{item.name}</h3>

                  <p>{item.pharmacyName}</p>

                  <p>
                    {item.dosage} · Rs. {item.price}
                  </p>

                  {item.prescriptionRequired && (
                    <span className="prescription-badge">
                      Prescription Required
                    </span>
                  )}

                  <div className="quantity-controls">
                    <button
                      onClick={() =>
                        decreaseQuantity(item.id)
                      }
                    >
                      −
                    </button>

                    <span>{item.quantity}</span>

                    <button
                      onClick={() =>
                        increaseQuantity(item.id)
                      }
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="cart-item-right">
                  <strong>
                    Rs. {item.price * item.quantity}
                  </strong>

                  <button
                    className="remove-text-button"
                    onClick={() => removeItem(item.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="cart-summary">
            <h2>Order Summary</h2>

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

           <Link
  to="/checkout"
  className="checkout-button checkout-link"
>
  Proceed to Checkout
</Link>

            <Link
              to="/"
              className="continue-shopping-link"
            >
              Continue Shopping
            </Link>
          </div>
        </>
      )}

      <BottomNav />
    </div>
  );
}

export default Cart;