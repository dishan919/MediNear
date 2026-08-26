import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/api";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleLogin(event) {
    event.preventDefault();

    if (!email.trim() || !password) {
      setError("Please enter email and password.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await api.post("/auth/login", {
        email: email.trim().toLowerCase(),
        password,
      });
       console.log("Login response:", response.data);
       console.log("Token:", response.data.token);
      localStorage.setItem("token", response.data.token);

      localStorage.setItem(
        "user",
        JSON.stringify(response.data.user)
      );

      alert("Login successful");

      navigate("/");
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "Invalid email or password."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">+</div>

        <h1>Welcome Back</h1>

        <p className="auth-description">
          Login to find nearby pharmacies.
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
              placeholder="example@gmail.com"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setError("");
              }}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="loginPassword">
              Password
            </label>

            <input
              id="loginPassword"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError("");
              }}
              disabled={loading}
            />
          </div>

          <label className="show-password-option">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={() =>
                setShowPassword((current) => !current)
              }
              disabled={loading}
            />

            Show password
          </label>

          <button
            type="submit"
            className="auth-submit-button"
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
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