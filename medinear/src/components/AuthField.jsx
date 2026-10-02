import { useState } from "react";

function AuthField({ name, label, type = "text", error, hint, ...inputProps }) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
  return (
    <div className="form-group">
      <label htmlFor={name}>{label}</label>
      <div className={isPassword ? "auth-password" : undefined}>
        <input {...inputProps} id={name} name={name} required
          type={isPassword && visible ? "text" : type}
          aria-invalid={Boolean(error)}
          aria-describedby={[error && `${name}-error`, hint && `${name}-hint`].filter(Boolean).join(" ") || undefined} />
        {isPassword && <button type="button" className="auth-password-toggle"
          disabled={inputProps.disabled} aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
          aria-pressed={visible} onClick={() => setVisible((current) => !current)}>
          {visible ? "Hide" : "Show"}
        </button>}
      </div>
      {hint && <p className="auth-field-hint" id={`${name}-hint`}>{hint}</p>}
      {error && <p className="auth-field-error" id={`${name}-error`}>{error}</p>}
    </div>
  );
}

export default AuthField;
