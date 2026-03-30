import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import MapView from '../../components/MapView';
import { getDashboard, getTrends, getHotspots, getWardStats, getWorkerPerformance, getReports } from '../../services/api';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#00d97e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const CustomTooltip = ({ active, payload, label }) =>
  active && payload?.length ? (
    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: 8, padding: '10px 14px', fontSize: '0.82rem' }}>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => <p key={i} style={{ color: p.color, fontWeight: 600 }}>{p.name}: {p.value}</p>)}
    </div>
  ) : null;

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState({});
  const [trends, setTrends] = useState([]);
  const [wards, setWards] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAll = async () => {
      try {
        const [sRes, tRes, wdRes, wpRes, rRes] = await Promise.all([
          getDashboard(), getTrends(30), getWardStats(), getWorkerPerformance(), getReports({ limit: 200 }),
        ]);
        setStats(sRes.data.data || {});
        setTrends(tRes.data.data?.trends || []);
        setWards(wdRes.data.data || []);
        setWorkers(wpRes.data.data || []);
        setReports(rRes.data.data || []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    loadAll();
  }, []);

  const severityData = [
    { name: 'Critical', value: reports.filter(r => r.severity === 'critical').length },
    { name: 'High', value: reports.filter(r => r.severity === 'high').length },
    { name: 'Medium', value: reports.filter(r => r.severity === 'medium').length },
    { name: 'Low', value: reports.filter(r => r.severity === 'low').length },
  ].filter(d => d.value > 0);

  const sourceData = [
    { name: 'Citizen', value: reports.filter(r => r.source === 'citizen').length },
    { name: 'CCTV', value: reports.filter(r => r.source === 'cctv').length },
  ].filter(d => d.value > 0);

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div>
            <div className="page-title">🏛 City Overview</div>
            <div className="page-subtitle">Super Admin · Full municipal analytics dashboard</div>
          </div>
        </div>

        {/* Main Stats */}
        <div className="stats-grid">
          {[
            { label: 'Total Incidents', value: stats.totalReports || 0, icon: '🗑️', cls: 'blue' },
            { label: 'Pending', value: stats.pendingReports || 0, icon: '⏳', cls: 'orange' },
            { label: 'Active', value: stats.assignedReports || 0, icon: '🔄', cls: 'cyan' },
            { label: 'Resolved', value: stats.completedReports || 0, icon: '✅', cls: 'green' },
            { label: 'Total Users', value: stats.totalUsers || 0, icon: '👥', cls: 'purple' },
            { label: 'Resolution %', value: `${stats.resolutionRate || 0}%`, icon: '📈', cls: 'green' },
          ].map(s => (
            <div key={s.label} className={`stat-card ${s.cls}`}>
              <div className="stat-icon">{s.icon}</div>
              <div className="stat-info"><div className="value">{s.value}</div><div className="label">{s.label}</div></div>
            </div>
          ))}
        </div>

        {/* Charts Row 1 */}
        <div className="grid-2" style={{ marginBottom: 20 }}>
          <div className="card">
            <div className="card-title">📈 30-Day Incident Trend</div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="_id" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} name="Reports" />
                <Line type="monotone" dataKey="resolved" stroke="#00d97e" strokeWidth={2} dot={false} name="Resolved" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            <div className="card-title">🎯 Severity Breakdown</div>
            {severityData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={severityData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {severityData.map((_, i) => <Cell key={i} fill={['#dc2626', '#ef4444', '#f59e0b', '#22c55e'][i]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state"><div className="empty-icon">📊</div><p>No data yet</p></div>
            )}
          </div>
        </div>

        {/* Map (Heatmap-style) */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title">🗺️ City-Wide Incident Map</div>
          {!loading && <MapView reports={reports} height="420px" />}
        </div>

        {/* Ward Stats */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title">🏘️ Ward-Level Performance</div>
          {wards.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={wards.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="_id" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="total" fill="#3b82f6" name="Total" radius={[4, 4, 0, 0]} />
                <Bar dataKey="completed" fill="#00d97e" name="Completed" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pending" fill="#f59e0b" name="Pending" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state"><div className="empty-icon">🏘️</div><p>Submit reports to see ward analytics</p></div>
          )}
        </div>

        {/* Worker Performance */}
        <div className="card">
          <div className="card-title">👷 Worker Performance</div>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Worker</th><th>Ward</th><th>Total Tasks</th><th>Completed</th><th>Completion Rate</th></tr></thead>
              <tbody>
                {workers.length === 0 ? (
                  <tr><td colSpan={5}><div className="empty-state">No worker data yet</div></td></tr>
                ) : workers.map((w) => (
                  <tr key={w._id}>
                    <td><div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{w.worker?.name}</div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{w.worker?.email}</div></td>
                    <td>{w.worker?.ward || '–'}</td>
                    <td>{w.total}</td>
                    <td>{w.completed}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="confidence-bar" style={{ width: 80 }}>
                          <div className="confidence-bar-fill" style={{ width: `${(w.completionRate || 0) * 100}%` }} />
                        </div>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-green)' }}>
                          {Math.round((w.completionRate || 0) * 100)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
