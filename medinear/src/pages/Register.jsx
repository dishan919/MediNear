import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/api";

function Register() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((previousData) => ({
      ...previousData,
      [name]: value,
    }));

    setError("");
  }

  function validateForm() {
    if (
      !formData.fullName.trim() ||
      !formData.email.trim() ||
      !formData.phone.trim() ||
      !formData.password ||
      !formData.confirmPassword
    ) {
      setError("Please fill in all fields.");
      return false;
    }

    if (!formData.email.includes("@")) {
      setError("Please enter a valid email address.");
      return false;
    }

    if (formData.phone.trim().length < 9) {
      setError("Please enter a valid phone number.");
      return false;
    }

    if (formData.password.length < 6) {
      setError("Password must contain at least 6 characters.");
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return false;
    }

    return true;
  }

  function handleRegister(event) {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    const savedUsers =
      JSON.parse(localStorage.getItem("users")) || [];

    const userAlreadyExists = savedUsers.some(
      (user) =>
        user.email.toLowerCase() ===
        formData.email.trim().toLowerCase()
    );

    if (userAlreadyExists) {
      setError("An account already exists with this email.");
      return;
    }

    const newUser = {
      id: Date.now(),
      fullName: formData.fullName.trim(),
      email: formData.email.trim().toLowerCase(),
      phone: formData.phone.trim(),
      password: formData.password,
      createdAt: new Date().toLocaleString(),
    };

    const updatedUsers = [...savedUsers, newUser];

    localStorage.setItem(
      "users",
      JSON.stringify(updatedUsers)
    );

    alert("Registration successful. Please login.");

    navigate("/login");
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">+</div>

        <h1>Create Account</h1>

        <p className="auth-description">
          Register to find medicines and nearby pharmacies.
        </p>

        {error && (
          <div className="error-message">{error}</div>
        )}

        <form onSubmit={handleRegister}>
          <div className="form-group">
            <label htmlFor="fullName">Full Name</label>

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
            <label htmlFor="registerEmail">
              Email Address
            </label>

            <input
              id="registerEmail"
              type="email"
              name="email"
              placeholder="example@gmail.com"
              value={formData.email}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="registerPhone">
              Phone Number
            </label>

            <input
              id="registerPhone"
              type="tel"
              name="phone"
              placeholder="+94 77 123 4567"
              value={formData.phone}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="registerPassword">
              Password
            </label>

            <input
              id="registerPassword"
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="Minimum 6 characters"
              value={formData.password}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">
              Confirm Password
            </label>

            <input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              name="confirmPassword"
              placeholder="Enter password again"
              value={formData.confirmPassword}
              onChange={handleChange}
            />
          </div>

          <label className="show-password-option">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={() =>
                setShowPassword(!showPassword)
              }
            />

            Show password
          </label>

          <button
            type="submit"
            className="auth-submit-button"
          >
            Create Account
          </button>
        </form>

        <p className="auth-switch-text">
          Already have an account?{" "}
          <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}

export default Register;