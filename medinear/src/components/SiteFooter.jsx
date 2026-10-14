import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import Icon from './Icon';
import '../styles/HomeSupport.css';

export default function SiteFooter() {
  const user = useAuth()?.user;
  return <footer className="mn-site-footer">
    <div className="mn-footer-inner"><div className="mn-footer-top">
      <div className="mn-footer-brand"><Link className="mn-logo" to="/"><span><Icon name="cross" /></span>MediNear</Link><p>Find the medicine you need, closer to you.</p></div>
      <nav className="mn-footer-links" aria-label="Explore"><h2>Explore</h2><Link to="/">Home</Link><a href="#medicine-search">Find Medicines</a>{user?.role === 'customer' && <Link to="/favorites">Saved Pharmacies</Link>}</nav>
      <nav className="mn-footer-links" aria-label="Support"><h2>Support</h2><a href="#faq">FAQ</a></nav>
    </div><div className="mn-footer-bottom"><p>&copy; {new Date().getFullYear()} MediNear</p><span>Pharmacy discovery, made simple.</span></div></div>
  </footer>;
}
