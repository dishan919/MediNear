import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/api";
import AuthLayout from "../components/AuthLayout";
import AuthField from "../components/AuthField";
import { validateRegister } from "../utils/authValidation";

function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ fullName: "", email: "", phone: "", password: "", confirmPassword: "", role: "customer" });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined,
      ...(name === "password" ? { confirmPassword: undefined } : {}) }));
    setError("");
  }

  async function handleRegister(event) {
    event.preventDefault();
    if (loading) return;
    const nextErrors = validateRegister(formData);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      event.currentTarget.elements[Object.keys(nextErrors)[0]].focus();
      return;
    }
    try {
      setLoading(true);
      setError("");
      const response = await api.post("/auth/register", {
        name: formData.fullName.trim(), email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(), password: formData.password, role: formData.role,
      });
      if (!response.data.success) throw new Error("Invalid registration response");
      navigate("/login", { replace: true, state: { registered: true } });
    } catch (requestError) {
      setErrors(requestError.response?.data?.errors || {});
      setError(requestError.response?.data?.message ||
        "Unable to register. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Create Account" description="Find nearby pharmacies and keep your healthcare within reach.">
      {error && <div className="error-message" role="alert">{error}</div>}
      <form onSubmit={handleRegister} noValidate aria-busy={loading}>
        <div className="form-group">
          <label htmlFor="account-role">Account Type</label>
          <select id="account-role" name="role" value={formData.role} onChange={handleChange}
            disabled={loading} aria-invalid={Boolean(errors.role)}
            aria-describedby={errors.role ? "account-role-error" : undefined}>
            <option value="customer">Customer</option>
            <option value="pharmacy_owner">Pharmacy Owner</option>
          </select>
          {errors.role && <p id="account-role-error" className="auth-field-error">{errors.role}</p>}
        </div>
        <AuthField name="fullName" label="Full Name" autoComplete="name" placeholder="Enter your full name"
          value={formData.fullName} onChange={handleChange} error={errors.fullName} disabled={loading} />
        <AuthField name="email" label="Email Address" type="email" autoComplete="email" placeholder="you@example.com"
          value={formData.email} onChange={handleChange} error={errors.email} disabled={loading} />
        <AuthField name="phone" label="Phone Number" type="tel" autoComplete="tel" placeholder="+94 77 123 4567"
          value={formData.phone} onChange={handleChange} error={errors.phone} disabled={loading} />
        <AuthField name="password" label="Password" type="password" autoComplete="new-password" placeholder="Create a secure password"
          hint="At least 8 characters, including uppercase, lowercase and a number."
          value={formData.password} onChange={handleChange} error={errors.password} disabled={loading} />
        <AuthField name="confirmPassword" label="Confirm Password" type="password" autoComplete="new-password" placeholder="Enter your password again"
          value={formData.confirmPassword} onChange={handleChange} error={errors.confirmPassword} disabled={loading} />
        <button type="submit" className="auth-submit-button" disabled={loading}>
          {loading ? "Creating account..." : "Register"}
        </button>
      </form>
      <p className="auth-switch-text">Already have an account? <Link to="/login">Login</Link></p>
    </AuthLayout>
  );
}

export default Register;
