import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

const CITIZEN_NAV = [
  { to: '/', icon: '🏠', label: 'My Dashboard' },
  { to: '/report/new', icon: '📸', label: 'Report Garbage' },
];

const ADMIN_NAV = [
  { to: '/admin', icon: '📊', label: 'Dashboard' },
  { to: '/admin/live-alerts', icon: '📹', label: 'Live CCTV Alerts' },
  { to: '/admin/tasks', icon: '✅', label: 'Task Management' },
];

const SUPERADMIN_NAV = [
  { to: '/superadmin', icon: '🌆', label: 'City Overview' },
  { to: '/admin', icon: '🗺️', label: 'Alert Dashboard' },
  { to: '/admin/live-alerts', icon: '📹', label: 'Live CCTV Alerts' },
  { to: '/admin/tasks', icon: '✅', label: 'Tasks' },
  { to: '/superadmin/users', icon: '👥', label: 'User Management' },
  { to: '/superadmin/audit', icon: '📋', label: 'Audit Logs' },
];

const WORKER_NAV = [
  { to: '/admin/tasks', icon: '✅', label: 'My Tasks' },
];

const rolesNav = { citizen: CITIZEN_NAV, admin: ADMIN_NAV, superadmin: SUPERADMIN_NAV, worker: WORKER_NAV };

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { alerts, cctvAlerts, isConnected } = useSocket() || {};
  const navLinks = rolesNav[user?.role] || CITIZEN_NAV;
  const location = useLocation();

  // Mobile menu state
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const roleLabel = {
    citizen: '👤 Citizen',
    admin: '🧑‍💼 Ward Admin',
    superadmin: '🏛 Super Admin',
    worker: '👷 Field Worker',
  };

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        className="mobile-menu-btn"
        onClick={() => setMobileOpen(prev => !prev)}
        aria-label="Toggle menu"
      >
        {mobileOpen ? '✕' : '☰'}
      </button>

      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay ${mobileOpen ? 'open' : ''}`}
        onClick={() => setMobileOpen(false)}
      />

      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <h1>🏙️ CleanCity</h1>
          <span>AI Waste Surveillance</span>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-label">Navigation</div>
          {navLinks.map(({ to, icon, label }) => (
            <NavLink key={to} to={to} end={to === '/' || to === '/admin' || to === '/superadmin'}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="icon">{icon}</span>
              {label}
            </NavLink>
          ))}

          {alerts && alerts.length > 0 && (
            <>
              <div className="nav-label" style={{ marginTop: '16px' }}>Live Alerts</div>
              <div style={{ padding: '6px 10px' }}>
                <div style={{
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 12px',
                  fontSize: '0.78rem',
                  color: 'var(--accent-red)',
                }}>
                  🔴 {alerts.length} live alert{alerts.length > 1 ? 's' : ''}
                </div>
              </div>
            </>
          )}
        </nav>

        <div className="sidebar-user">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'var(--glass)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.1rem',
            }}>
              {user?.name?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <div className="user-name">{user?.name || 'User'}</div>
              <div className="user-role">{roleLabel[user?.role] || user?.role}</div>
            </div>
          </div>
          <button className="btn-logout" onClick={logout}>
            <span>🚪</span> Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
