import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import ThemeToggle from './components/ThemeToggle';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import CitizenDashboard from './pages/citizen/Dashboard';
import NewReport from './pages/citizen/NewReport';
import AdminDashboard from './pages/admin/Dashboard';
import TaskManagement from './pages/admin/TaskManagement';
import SuperAdminDashboard from './pages/superadmin/Dashboard';
import UserManagement from './pages/superadmin/UserManagement';
import AuditLogs from './pages/superadmin/AuditLogs';
import LiveAlerts from './pages/admin/LiveAlerts';

const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen"><div className="spinner" /><p>Loading…</p></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/unauthorized" replace />;
  return children;
};

const AppRoutes = () => {
  const { user } = useAuth();
  const homeRoute = user?.role === 'superadmin' ? '/superadmin'
    : user?.role === 'admin' ? '/admin'
    : user?.role === 'worker' ? '/admin/tasks'
    : '/';

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Citizen */}
      <Route path="/" element={<ProtectedRoute><CitizenDashboard /></ProtectedRoute>} />
      <Route path="/report/new" element={<ProtectedRoute><NewReport /></ProtectedRoute>} />

      {/* Admin + Worker */}
      <Route path="/admin" element={<ProtectedRoute roles={['admin', 'superadmin']}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/live-alerts" element={<ProtectedRoute roles={['admin', 'superadmin']}><LiveAlerts /></ProtectedRoute>} />
      <Route path="/admin/tasks" element={<ProtectedRoute roles={['admin', 'superadmin', 'worker']}><TaskManagement /></ProtectedRoute>} />

      {/* Super Admin */}
      <Route path="/superadmin" element={<ProtectedRoute roles={['superadmin']}><SuperAdminDashboard /></ProtectedRoute>} />
      <Route path="/superadmin/users" element={<ProtectedRoute roles={['superadmin']}><UserManagement /></ProtectedRoute>} />
      <Route path="/superadmin/audit" element={<ProtectedRoute roles={['superadmin']}><AuditLogs /></ProtectedRoute>} />

      <Route path="/unauthorized" element={<div className="error-page"><h1>403</h1><p>You are not authorized to view this page.</p></div>} />
      <Route path="*" element={<Navigate to={homeRoute} replace />} />
    </Routes>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <ThemeToggle />
      <AuthProvider>
        <SocketProvider>
          <AppRoutes />
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
