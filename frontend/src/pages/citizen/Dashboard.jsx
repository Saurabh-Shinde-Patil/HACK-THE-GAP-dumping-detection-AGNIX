import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import { getReports, getReportStats } from '../../services/api';

const statusIcon = { pending: '⏳', assigned: '📋', 'in-progress': '🔄', completed: '✅', rejected: '❌' };

export default function CitizenDashboard() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ pending: 0, completed: 0, total: 0 });

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getReports({ limit: 50 });
        const data = res.data.data || [];
        setReports(data);
        setStats({
          total: res.data.pagination?.total || data.length,
          pending: data.filter(r => r.status === 'pending').length,
          completed: data.filter(r => r.status === 'completed').length,
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div>
            <div className="page-title">🏠 My Reports</div>
            <div className="page-subtitle">Track your garbage complaint history</div>
          </div>
          <Link to="/report/new" className="btn btn-primary">📸 New Report</Link>
        </div>

        <div className="stats-grid">
          {[
            { label: 'Total Reports', value: stats.total, icon: '📁', cls: 'blue' },
            { label: 'Pending', value: stats.pending, icon: '⏳', cls: 'orange' },
            { label: 'Completed', value: stats.completed, icon: '✅', cls: 'green' },
            { label: 'Resolution Rate', value: stats.total ? `${Math.round((stats.completed / stats.total) * 100)}%` : '–', icon: '📈', cls: 'cyan' },
          ].map((s) => (
            <div className={`stat-card ${s.cls}`} key={s.label}>
              <div className="stat-icon">{s.icon}</div>
              <div className="stat-info">
                <div className="value">{s.value}</div>
                <div className="label">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-title">📋 Report History</div>
          {loading ? (
            <div className="empty-state"><div className="spinner" /></div>
          ) : reports.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📭</div>
              <p>No reports yet. <Link to="/report/new" style={{ color: 'var(--accent-green)' }}>Submit your first one!</Link></p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Image</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>Severity</th>
                    <th>AI Confidence</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r._id}>
                      <td>
                        <img src={r.image} alt="report"
                          style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8 }}
                          onError={e => { e.target.style.display = 'none'; }}
                        />
                      </td>
                      <td>
                        <div style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '0.85rem' }}>{r.address}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.ward}</div>
                      </td>
                      <td>
                        <span className={`badge badge-${r.status}`}>{statusIcon[r.status]} {r.status}</span>
                      </td>
                      <td>
                        <span className={`badge badge-${r.severity}`}>{r.severity}</span>
                      </td>
                      <td>
                        <div style={{ minWidth: '80px' }}>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 3 }}>
                            {Math.round((r.detectionConfidence || 0) * 100)}%
                          </div>
                          <div className="confidence-bar">
                            <div className="confidence-bar-fill" style={{ width: `${(r.detectionConfidence || 0) * 100}%` }} />
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
