import { useAuth } from "../auth/AuthContext";
import "../styles/PharmacyDashboard.css";

const sections = [
  ["Pharmacy Profile", "Your pharmacy details and contact information."],
  ["Medicines", "Your pharmacy's medicine catalogue."],
  ["Medicine Stock", "Stock levels and medicine availability."],
  ["Opening Hours", "Your pharmacy's opening schedule."],
  ["Orders / Requests", "Customer requests and orders in a future update."],
];

export default function PharmacyDashboard() {
  const { user } = useAuth();
  return (
    <main className="owner-dashboard">
      <header>
        <p className="owner-dashboard-label">Pharmacy Owner Dashboard</p>
        <h1>Welcome, {user.fullName || user.name}</h1>
        <p>Your space to manage your pharmacy. These tools will be available in future updates.</p>
      </header>
      <section className="owner-dashboard-grid" aria-label="Upcoming pharmacy tools">
        {sections.map(([title, description]) => (
          <article className="owner-dashboard-card" key={title}>
            <h2>{title}</h2>
            <p>{description}</p>
            <span className="owner-dashboard-badge">Coming soon</span>
          </article>
        ))}
      </section>
    </main>
  );
}
