import { useEffect, useState } from "react";
import BottomNav from "../components/BottomNav";

function Orders() {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    const savedOrders =
      JSON.parse(localStorage.getItem("orders")) || [];

    setOrders(savedOrders);
  }, []);

  function cancelOrder(orderId) {
    const confirmed = window.confirm(
      "Are you sure you want to cancel this order?"
    );

    if (!confirmed) {
      return;
    }

    const updatedOrders = orders.map((order) =>
      order.id === orderId
        ? {
            ...order,
            status: "Cancelled",
          }
        : order
    );

    setOrders(updatedOrders);

    localStorage.setItem(
      "orders",
      JSON.stringify(updatedOrders)
    );
  }

  return (
    <div className="page">
      <header className="simple-header">
        <h1>My Orders</h1>
        <p>Track and manage your orders</p>
      </header>

      {orders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📦</div>

          <h2>No orders yet</h2>

          <p>
            Your medicine orders will appear here.
          </p>
        </div>
      ) : (
        <div className="order-list">
          {orders.map((order) => (
            <div
              className="order-card"
              key={order.id}
            >
              <div className="order-top">
                <div>
                  <h3>{order.id}</h3>
                  <p>{order.orderDate}</p>
                </div>

                <span
                  className={
                    order.status === "Cancelled"
                      ? "status closed"
                      : "status preparing"
                  }
                >
                  {order.status}
                </span>
              </div>

              <p>
                Customer: {order.customer.fullName}
              </p>

              <p>
                Delivery: {order.deliveryMethod}
              </p>

              <p>
                Payment: {order.paymentMethod}
              </p>

              <div className="order-items">
                {order.items.map((item) => (
                  <div
                    className="order-item-row"
                    key={item.id}
                  >
                    <span>
                      {item.name} × {item.quantity}
                    </span>

                    <span>
                      Rs. {item.price * item.quantity}
                    </span>
                  </div>
                ))}
              </div>

              <div className="order-total-row">
                <strong>Total</strong>
                <strong>Rs. {order.total}</strong>
              </div>

              {order.status !== "Cancelled" && (
                <button
                  className="cancel-order-button"
                  onClick={() =>
                    cancelOrder(order.id)
                  }
                >
                  Cancel Order
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <BottomNav />
    </div>
  );
}

export default Orders;