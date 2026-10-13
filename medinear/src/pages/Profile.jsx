import { useEffect, useState } from "react";
import api from "../api/api";
import Icon from "../components/Icon";
import "../styles/MedicineUI.css";
import "../styles/Profile.css";

function Profile() {
  const [user, setUser] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    address: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  useEffect(() => {
    async function fetchProfile() {
      try {
        const token = localStorage.getItem("token");

        if (!token) {
          setError("Please login again.");
          return;
        }

        const response = await api.get(
          "/users/profile",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const userData = response.data.user;

        setUser(userData);

        setFormData({
          name: userData.name || "",
          phone: userData.phone || "",
          address: userData.address || "",
        });
      } catch (error) {
        console.error("Profile error:", error);

        setError(
          error.response?.data?.message ||
            "Unable to load profile."
        );
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((previousData) => ({
      ...previousData,
      [name]: value,
    }));

    setError("");
    setSuccessMessage("");
  }

  async function handleUpdate(event) {
    event.preventDefault();

    if (!formData.name.trim()) {
      setError("Name is required.");
      return;
    }

    if (
      formData.phone.trim() &&
      formData.phone.trim().length < 9
    ) {
      setError("Please enter a valid phone number.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccessMessage("");

      const token = localStorage.getItem("token");

      const response = await api.put(
        "/users/profile",
        {
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          address: formData.address.trim(),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const updatedUser = response.data.user;

      setUser(updatedUser);

      setFormData({
        name: updatedUser.name || "",
        phone: updatedUser.phone || "",
        address: updatedUser.address || "",
      });

      const savedUser = JSON.parse(
        localStorage.getItem("user") || "{}"
      );

      localStorage.setItem(
        "user",
        JSON.stringify({
          ...savedUser,
          ...updatedUser,
        })
      );

      setSuccessMessage(
        response.data.message ||
          "Profile updated successfully."
      );

      setIsEditing(false);
    } catch (error) {
      console.error("Update profile error:", error);

      setError(
        error.response?.data?.message ||
          "Unable to update profile."
      );
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setFormData({
      name: user.name || "",
      phone: user.phone || "",
      address: user.address || "",
    });

    setError("");
    setSuccessMessage("");
    setIsEditing(false);
  }

  const nameParts = user?.name?.trim().split(/\s+/).filter(Boolean) || [];
  const initials = nameParts.length
    ? `${nameParts[0][0]}${nameParts.length > 1 ? nameParts[nameParts.length - 1][0] : ""}`.toUpperCase()
    : "";
  const roleLabel = user?.role === "pharmacy_owner"
    ? "Pharmacy Owner"
    : user?.role === "customer" ? "Customer" : user?.role;

  return (
    <main className="mn-app mn-profile-page">
      <div className="mn-profile-inner">
        <header className="mn-profile-header">
          <h1>My Profile</h1>
          <p>Manage your personal information and account details.</p>
        </header>

        {loading ? (
          <div className="mn-profile-card mn-profile-state" role="status" aria-live="polite">
            Loading profile...
          </div>
        ) : !user ? (
          <div className="mn-profile-card mn-profile-state">
            <p className="mn-profile-notice mn-profile-error" role="alert">
              {error || "User data not found."}
            </p>
          </div>
        ) : (
          <section className="mn-profile-card" aria-labelledby="profile-user-name">
            <div className="mn-profile-identity">
              <div className="mn-profile-avatar" aria-hidden="true">{initials}</div>
              <div className="mn-profile-user">
                <h2 id="profile-user-name">{user.name}</h2>
                {roleLabel && <span className="mn-badge mn-positive">{roleLabel}</span>}
              </div>
            </div>

            {error && <p className="mn-profile-notice mn-profile-error" role="alert">{error}</p>}
            {successMessage && <p className="mn-profile-notice mn-profile-success" role="status">{successMessage}</p>}

            <section className="mn-profile-information" aria-labelledby="profile-information-title">
              <h3 id="profile-information-title">Personal Information</h3>
              {!isEditing ? (
                <>
                  <dl className="mn-profile-grid">
                    {[
                      ["Name", user.name],
                      ["Email", user.email],
                      ["Phone", user.phone?.trim() || "Not added"],
                      ["Address", user.address?.trim() || "Not added"],
                    ].map(([label, value]) => (
                      <div className="mn-profile-field" key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mn-profile-actions">
                    <button className="mn-button mn-primary" type="button" onClick={() => {
                      setIsEditing(true);
                      setError("");
                      setSuccessMessage("");
                    }}>
                      <Icon name="edit" size={18} />
                      Edit Profile
                    </button>
                  </div>
                </>
              ) : (
                <form onSubmit={handleUpdate} aria-busy={saving}>
                  <div className="mn-profile-grid">
                    <div className="mn-profile-field">
                      <label htmlFor="profileName">Name</label>
                      <input id="profileName" type="text" name="name" autoComplete="name" value={formData.name} onChange={handleChange} disabled={saving} />
                    </div>
                    <div className="mn-profile-field">
                      <label htmlFor="profileEmail">Email</label>
                      <input id="profileEmail" type="email" value={user.email} disabled aria-describedby="profile-email-help" />
                      <p id="profile-email-help" className="mn-profile-help">Email cannot be edited.</p>
                    </div>
                    <div className="mn-profile-field">
                      <label htmlFor="profilePhone">Phone</label>
                      <input id="profilePhone" type="tel" name="phone" autoComplete="tel" value={formData.phone} onChange={handleChange} disabled={saving} />
                    </div>
                    <div className="mn-profile-field">
                      <label htmlFor="profileAddress">Address</label>
                      <textarea id="profileAddress" name="address" autoComplete="street-address" value={formData.address} onChange={handleChange} disabled={saving} rows="4" />
                    </div>
                  </div>
                  <div className="mn-profile-actions">
                    <button className="mn-button mn-primary" type="submit" disabled={saving}>
                      {saving ? "Saving..." : "Save Changes"}
                    </button>
                    <button className="mn-button mn-secondary" type="button" onClick={handleCancel} disabled={saving}>Cancel</button>
                  </div>
                </form>
              )}
            </section>
          </section>
        )}
      </div>
    </main>
  );
}

export default Profile;
