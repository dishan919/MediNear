import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "../api/api";
import AuthLayout from "../components/AuthLayout";
import AuthField from "../components/AuthField";
import { validateLogin } from "../utils/authValidation";
import { useAuth } from "../auth/AuthContext";

function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setError("");
  }

  async function handleLogin(event) {
    event.preventDefault();
    if (loading) return;
    const nextErrors = validateLogin(formData);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      event.currentTarget.elements[Object.keys(nextErrors)[0]].focus();
      return;
    }
    try {
      setLoading(true);
      setError("");
      const response = await api.post("/auth/login", {
        email: formData.email.trim().toLowerCase(), password: formData.password,
      });
      if (!response.data.success || !response.data.token || !response.data.user) {
        throw new Error("Invalid authentication response");
      }
      login(response.data);
      navigate("/", { replace: true });
    } catch (requestError) {
      setErrors(requestError.response?.data?.errors || {});
      setError(requestError.response?.data?.message ||
        "Unable to login. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Welcome Back" description="Login to find pharmacies near you">
      {location.state?.registered && <p className="auth-notice" role="status">Account created successfully. Please login.</p>}
      {error && <div className="error-message" role="alert">{error}</div>}
      <form onSubmit={handleLogin} noValidate aria-busy={loading}>
        <AuthField name="email" label="Email Address" type="email" autoComplete="email"
          placeholder="you@example.com" value={formData.email} onChange={handleChange}
          error={errors.email} disabled={loading} />
        <AuthField name="password" label="Password" type="password" autoComplete="current-password"
          placeholder="Enter your password" value={formData.password} onChange={handleChange}
          error={errors.password} disabled={loading} />
        <a className="auth-forgot-link" href="#password-recovery" onClick={() => setShowRecovery(true)}>Forgot Password?</a>
        {showRecovery && <p id="password-recovery" className="auth-notice" role="status">
          Password recovery is not available yet. A secure reset service needs to be connected before you can reset your password.
        </p>}
        <button type="submit" className="auth-submit-button" disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
      <p className="auth-switch-text">Don't have an account? <Link to="/register">Sign Up</Link></p>
    </AuthLayout>
  );
}

export default Login;
