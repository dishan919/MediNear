import { Link, useParams } from "react-router-dom";

function OrderSuccess() {
  const { orderId } = useParams();

  return (
    <div className="page order-success-page">
      <div className="success-icon">
        ✓
      </div>

      <h1>Order Placed Successfully!</h1>

      <p>
        Your medicine order has been received.
      </p>

      <div className="success-order-card">
        <span>Order Number</span>
        <strong>{orderId}</strong>

        <span>Status</span>
        <strong className="success-status">
          Order Placed
        </strong>
      </div>

      <Link
        to="/orders"
        className="primary-link-button success-link"
      >
        View My Orders
      </Link>

      <Link
        to="/"
        className="continue-shopping-link"
      >
        Return to Home
      </Link>
    </div>
  );
}

export default OrderSuccess;