import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import { getReports, getReportStats } from '../../services/api';

const statusIcon = { pending: '⏳', assigned: '📋', 'in-progress': '🔄', completed: '✅', rejected: '❌' };

const ReportTrackerCard = ({ report }) => {
  const steps = [
    { id: 'pending', label: 'Reported', icon: '📝' },
    { id: 'assigned', label: 'Assigned', icon: '👷' },
    { id: 'in-progress', label: 'Cleaning', icon: '🧹' },
    { id: 'completed', label: 'Resolved', icon: '✅' }
  ];

  let currentStepIndex = 0;
  if (report.status === 'assigned') currentStepIndex = 1;
  if (report.status === 'in-progress') currentStepIndex = 2;
  if (report.status === 'completed' || report.status === 'verified') currentStepIndex = 3;
  if (report.status === 'rejected') currentStepIndex = -1; // Specific red state

  return (
    <div className="card" style={{ marginBottom: 16, padding: '20px', background: 'var(--glass)' }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Thumbnail */}
        <img 
          src={report.image} 
          alt="report"
          style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}
          onError={e => { e.target.style.display = 'none'; }}
        />
        
        {/* Info */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>📍 {report.address}</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {new Date(report.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 8 }}>Ward: {report.ward || 'Unknown'}</div>
          
          {report.status === 'rejected' ? (
            <div style={{ padding: '12px', borderRadius: 8, background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
              ❌ This report was reviewed and rejected.
            </div>
          ) : (
            /* E-commerce Style Tracker Bar */
            <div style={{ display: 'flex', alignItems: 'center', marginTop: 16, padding: '0 10px' }}>
              {steps.map((step, index) => {
                const isCompleted = index <= currentStepIndex;
                const isActive = index === currentStepIndex;
                const isLast = index === steps.length - 1;
                
                return (
                  <div key={step.id} style={{ display: 'flex', alignItems: 'center', flex: isLast ? 'none' : 1 }}>
                    {/* Circle */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: isCompleted ? 'var(--accent-green)' : 'rgba(255,255,255,0.05)',
                        border: isActive ? '2px solid #fff' : `2px solid ${isCompleted ? 'var(--accent-green)' : 'rgba(255,255,255,0.2)'}`,
                        color: isCompleted ? '#fff' : 'rgba(255,255,255,0.4)',
                        fontSize: '1rem', zIndex: 2, transition: 'all 0.3s ease'
                      }}>
                        {isCompleted ? '✓' : step.icon}
                      </div>
                      <span style={{ 
                        position: 'absolute', top: 40, fontSize: '0.7rem', fontWeight: isActive ? 700 : 500,
                        color: isCompleted ? 'var(--accent-green)' : 'var(--text-muted)', whiteSpace: 'nowrap'
                      }}>
                        {step.label}
                      </span>
                    </div>
                    {/* Connector Line */}
                    {!isLast && (
                      <div style={{
                        flex: 1, height: 4, margin: '0 8px', borderRadius: 2,
                        background: index < currentStepIndex ? 'var(--accent-green)' : 'rgba(255,255,255,0.1)',
                        transition: 'background 0.3s ease'
                      }} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div style={{ marginTop: 24 }} /> {/* spacing for absolutely positioned labels */}
        </div>
      </div>
    </div>
  );
};

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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {reports.map((r) => (
                <ReportTrackerCard key={r._id} report={r} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
