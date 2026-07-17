import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

function Login() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
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

  function handleLogin(event) {
    event.preventDefault();

    if (
      !formData.email.trim() ||
      !formData.password
    ) {
      setError("Please enter your email and password.");
      return;
    }

    const savedUsers =
      JSON.parse(localStorage.getItem("users")) || [];

    const matchedUser = savedUsers.find(
      (user) =>
        user.email.toLowerCase() ===
          formData.email.trim().toLowerCase() &&
        user.password === formData.password
    );

    if (!matchedUser) {
      setError("Invalid email or password.");
      return;
    }

    const loggedInUser = {
      id: matchedUser.id,
      fullName: matchedUser.fullName,
      email: matchedUser.email,
      phone: matchedUser.phone,
    };

    localStorage.setItem(
      "loggedInUser",
      JSON.stringify(loggedInUser)
    );

    navigate("/");
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">+</div>

        <h1>Welcome Back</h1>

        <p className="auth-description">
          Login to continue to MediNear.
        </p>

        {error && (
          <div className="error-message">{error}</div>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="loginEmail">
              Email Address
            </label>

            <input
              id="loginEmail"
              type="email"
              name="email"
              placeholder="example@gmail.com"
              value={formData.email}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="loginPassword">
              Password
            </label>

            <input
              id="loginPassword"
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="Enter your password"
              value={formData.password}
              onChange={handleChange}
            />
          </div>

          <div className="login-options">
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
              type="button"
              className="forgot-password-button"
              onClick={() =>
                alert(
                  "Forgot password will be added later."
                )
              }
            >
              Forgot password?
            </button>
          </div>

          <button
            type="submit"
            className="auth-submit-button"
          >
            Login
          </button>
        </form>

        <p className="auth-switch-text">
          Don't have an account?{" "}
          <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;