import "../styles/Auth.css";

function AuthLayout({ title, description, children }) {
  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand"><span className="auth-logo" aria-hidden="true">+</span><span>MediNear</span></div>
        <h1 id="auth-title">{title}</h1>
        <p className="auth-description">{description}</p>
        {children}
      </section>
    </main>
  );
}

export default AuthLayout;
