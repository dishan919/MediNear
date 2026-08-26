import { useEffect, useState } from "react";
import api from "../api/api";

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

  if (loading) {
    return (
      <div style={{ padding: "30px" }}>
        Loading profile...
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ padding: "30px" }}>
        <p style={{ color: "red" }}>
          {error || "User data not found."}
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: "30px" }}>
      <h1>My Profile</h1>

      {error && (
        <p style={{ color: "red" }}>
          {error}
        </p>
      )}

      {successMessage && (
        <p style={{ color: "green" }}>
          {successMessage}
        </p>
      )}

      {!isEditing ? (
        <div>
          <p>
            <strong>Name:</strong> {user.name}
          </p>

          <p>
            <strong>Email:</strong> {user.email}
          </p>

          <p>
            <strong>Phone:</strong>{" "}
            {user.phone || "Not added"}
          </p>

          <p>
            <strong>Address:</strong>{" "}
            {user.address || "Not added"}
          </p>

          <p>
            <strong>Role:</strong> {user.role}
          </p>

          <button
            type="button"
            onClick={() => {
              setIsEditing(true);
              setError("");
              setSuccessMessage("");
            }}
          >
            Edit Profile
          </button>
        </div>
      ) : (
        <form onSubmit={handleUpdate}>
          <div style={{ marginBottom: "15px" }}>
            <label htmlFor="profileName">
              Name
            </label>

            <br />

            <input
              id="profileName"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              disabled={saving}
            />
          </div>

          <div style={{ marginBottom: "15px" }}>
            <label htmlFor="profileEmail">
              Email
            </label>

            <br />

            <input
              id="profileEmail"
              type="email"
              value={user.email}
              disabled
            />
          </div>

          <div style={{ marginBottom: "15px" }}>
            <label htmlFor="profilePhone">
              Phone
            </label>

            <br />

            <input
              id="profilePhone"
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              disabled={saving}
            />
          </div>

          <div style={{ marginBottom: "15px" }}>
            <label htmlFor="profileAddress">
              Address
            </label>

            <br />

            <textarea
              id="profileAddress"
              name="address"
              value={formData.address}
              onChange={handleChange}
              disabled={saving}
              rows="4"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
          >
            {saving
              ? "Saving..."
              : "Save Changes"}
          </button>

          <button
            type="button"
            onClick={handleCancel}
            disabled={saving}
            style={{ marginLeft: "10px" }}
          >
            Cancel
          </button>
        </form>
      )}
    </div>
  );
}

export default Profile;