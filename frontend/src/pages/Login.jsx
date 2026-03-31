import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const userData = await login(form.email, form.password);
      const redirect = userData.role === 'superadmin' ? '/superadmin'
        : userData.role === 'admin' ? '/admin'
        : userData.role === 'worker' ? '/admin/tasks'
        : '/';
      navigate(redirect);
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (role) => {
    const creds = {
      superadmin: { email: 'superadmin@cleancity.com', password: 'admin123' },
      admin: { email: 'admin@cleancity.com', password: 'admin123' },
      worker: { email: 'worker@cleancity.com', password: 'admin123' },
      citizen: { email: 'citizen@cleancity.com', password: 'admin123' },
    };
    setForm(creds[role]);
  };

  return (
    <div className="auth-page">
      <div className="auth-left">
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🏙️</div>
          <div className="brand-title">CleanCity AI</div>
          <div style={{ 
            fontSize: '2.8rem', 
            fontWeight: 800, 
            marginTop: '-16px',
            marginBottom: '16px',
            background: 'linear-gradient(135deg, var(--accent-green), var(--accent-cyan))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            fontFamily: "'Outfit', sans-serif"
          }}>
            छत्रपती संभाजीनगर
          </div>
          <p className="brand-desc">Smart Municipal Waste Surveillance & Enforcement System powered by AI</p>
        </div>
        <div className="feature-list">
          {[
            { icon: '🤖', text: 'YOLOv8 AI garbage detection' },
            { icon: '📍', text: 'Geo-tagged incident reporting' },
            { icon: '⚡', text: 'Real-time alert system' },
            { icon: '📊', text: 'Hotspot analytics & heatmaps' },
            { icon: '👷', text: 'Municipal task workflow' },
          ].map((f, i) => (
            <div className="feature-item" key={i}>
              <span className="f-icon">{f.icon}</span>
              {f.text}
            </div>
          ))}
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-box">
          <h2>Welcome back 👋</h2>
          <p className="subtitle">Sign in to your CleanCity account</p>

          {error && (
            <div className="toast error" style={{ marginBottom: '16px', position: 'relative', animation: 'none' }}>
              ❌ {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" placeholder="you@example.com"
                value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" placeholder="••••••••"
                value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required />
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading}
              style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}>
              {loading ? '⏳ Signing in…' : '🔐 Sign In'}
            </button>
          </form>

          <div className="auth-divider">Quick Demo Login</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {[
              { role: 'superadmin', label: '🏛 Super Admin', color: 'var(--accent-purple)' },
              { role: 'admin', label: '🧑‍💼 Admin', color: 'var(--accent-blue)' },
              { role: 'worker', label: '👷 Worker', color: 'var(--accent-orange)' },
              { role: 'citizen', label: '👤 Citizen', color: 'var(--accent-green)' },
            ].map(({ role, label, color }) => (
              <button key={role} onClick={() => fillDemo(role)}
                className="btn btn-secondary btn-sm" style={{ fontSize: '0.78rem', borderColor: `${color}40`, color }}>
                {label}
              </button>
            ))}
          </div>

          <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '20px' }}>
            No account? <Link to="/register" style={{ color: 'var(--accent-green)', textDecoration: 'none', fontWeight: 600 }}>Register here</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
