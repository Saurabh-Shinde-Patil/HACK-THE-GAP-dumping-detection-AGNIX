import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import MapView from '../../components/MapView';
import { getReports, getReportStats, getDashboard } from '../../services/api';
import { useSocket } from '../../context/SocketContext';

const sev = { critical: 'badge-critical', high: 'badge-high', medium: 'badge-medium', low: 'badge-low' };
const statusBadge = { pending: 'badge-pending', assigned: 'badge-assigned', 'in-progress': 'badge-in-progress', completed: 'badge-completed', rejected: 'badge-rejected' };

export default function AdminDashboard() {
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const { alerts } = useSocket() || {};

  const load = async () => {
    try {
      const [rRes, sRes] = await Promise.all([getReports({ limit: 100 }), getDashboard()]);
      setReports(rRes.data.data || []);
      setStats(sRes.data.data || {});
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Refresh when new socket alert comes in
  useEffect(() => {
    if (alerts && alerts.length > 0) load();
  }, [alerts]);

  const filtered = filter ? reports.filter(r => r.status === filter) : reports;

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div>
            <div className="page-title">📊 Admin Dashboard</div>
            <div className="page-subtitle">Monitor alerts and manage cleanup tasks</div>
          </div>
          <button className="btn btn-secondary" onClick={load}>🔄 Refresh</button>
        </div>

        {/* Stats */}
        <div className="stats-grid">
          {[
            { label: 'Total Reports', value: stats.totalReports || 0, icon: '📁', cls: 'blue' },
            { label: 'Pending', value: stats.pendingReports || 0, icon: '⏳', cls: 'orange' },
            { label: 'Active', value: stats.assignedReports || 0, icon: '🔄', cls: 'cyan' },
            { label: 'Completed', value: stats.completedReports || 0, icon: '✅', cls: 'green' },
            { label: 'Resolution %', value: `${stats.resolutionRate || 0}%`, icon: '📈', cls: 'purple' },
            { label: 'Live Alerts', value: alerts?.length || 0, icon: '🔴', cls: 'red' },
          ].map(s => (
            <div key={s.label} className={`stat-card ${s.cls}`}>
              <div className="stat-icon">{s.icon}</div>
              <div className="stat-info"><div className="value">{s.value}</div><div className="label">{s.label}</div></div>
            </div>
          ))}
        </div>

        {/* Live Alerts Banner */}
        {alerts?.length > 0 && (
          <div className="card" style={{ marginBottom: 20, borderColor: 'rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.05)' }}>
            <div className="card-title" style={{ color: 'var(--accent-red)' }}>🔴 Live Alerts ({alerts.length})</div>
            <div className="alert-feed">
              {alerts.slice(0, 3).map((a, i) => (
                <div key={i} className={`alert-item ${a.severity}`}>
                  <span style={{ fontSize: '1.5rem' }}>🚨</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{a.address || 'New Alert'}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      Severity: <span className={`badge ${sev[a.severity]}`}>{a.severity}</span> · {a.source}
                    </div>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {new Date(a._alertTs || Date.now()).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Map */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title">🗺️ Incident Map</div>
          {!loading && <MapView reports={filtered} height="380px" />}
        </div>

        {/* Reports Table */}
        <div className="card">
          <div className="flex-between" style={{ marginBottom: 16 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>📋 Reports</div>
            <select className="form-select" style={{ width: 160 }} value={filter} onChange={e => setFilter(e.target.value)}>
              <option value="">All Status</option>
              {['pending', 'assigned', 'in-progress', 'completed', 'rejected'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {loading ? (
            <div className="empty-state"><div className="spinner" /></div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Image</th><th>Address</th><th>Source</th><th>Severity</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r._id}>
                      <td><img src={r.image} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6 }} onError={e => e.target.style.display = 'none'} /></td>
                      <td>
                        <div style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '0.85rem' }}>{r.address}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{r.ward}</div>
                      </td>
                      <td><span style={{ fontSize: '0.82rem' }}>{r.source === 'cctv' ? '📹 CCTV' : '📱 Citizen'}</span></td>
                      <td><span className={`badge ${sev[r.severity]}`}>{r.severity}</span></td>
                      <td><span className={`badge ${statusBadge[r.status]}`}>{r.status}</span></td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && <div className="empty-state"><div className="empty-icon">📭</div><p>No reports found</p></div>}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
