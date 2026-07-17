import { useNavigate } from "react-router-dom";
import BottomNav from "../components/BottomNav";

function Profile() {
  const navigate = useNavigate();

  const user =
    JSON.parse(localStorage.getItem("loggedInUser")) ||
    {};

  function handleLogout() {
    const confirmed = window.confirm(
      "Are you sure you want to logout?"
    );

    if (!confirmed) {
      return;
    }

    localStorage.removeItem("loggedInUser");

    navigate("/login");
  }

  const firstLetter = user.fullName
    ? user.fullName.charAt(0).toUpperCase()
    : "U";

  return (
    <div className="page">
      <header className="simple-header">
        <h1>Profile</h1>
        <p>Manage your account</p>
      </header>

      <div className="profile-card">
        <div className="large-profile-circle">
          {firstLetter}
        </div>

        <h2>{user.fullName || "User"}</h2>

        <p>{user.email || "No email"}</p>

        <p>{user.phone || "No phone number"}</p>

        <button className="primary-button">
          Edit Profile
        </button>
      </div>

      <div className="menu-list">
        <button>My Prescriptions</button>
        <button>Saved Addresses</button>
        <button>Payment Methods</button>
        <button>Notifications</button>
        <button>Help and Support</button>

        <button
          className="logout-button"
          onClick={handleLogout}
        >
          Logout
        </button>
      </div>

      <BottomNav />
    </div>
  );
}

export default Profile;