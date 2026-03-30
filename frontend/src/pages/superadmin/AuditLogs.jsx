import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import { getAuditLogs } from '../../services/api';

const actionColors = {
  CREATE_REPORT: 'var(--accent-green)',
  UPDATE_REPORT: 'var(--accent-blue)',
  ASSIGN_TASK: 'var(--accent-cyan)',
  UPDATE_TASK: 'var(--accent-orange)',
  CHANGE_ROLE: 'var(--accent-purple)',
  DEACTIVATE_USER: 'var(--accent-red)',
};

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 50;

  const load = async () => {
    setLoading(true);
    try {
      const res = await getAuditLogs({ page, limit, ...(search ? { action: search } : {}) });
      setLogs(res.data.data || []);
      setTotal(res.data.pagination?.total || 0);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [page, search]);

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div>
            <div className="page-title">📋 Audit Logs</div>
            <div className="page-subtitle">Full governance trail of all system actions ({total} entries)</div>
          </div>
          <button className="btn btn-secondary" onClick={load}>🔄 Refresh</button>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <input className="form-input" placeholder="Filter by action (e.g. ASSIGN_TASK)…"
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{ maxWidth: 300 }} />
        </div>

        <div className="card">
          {loading ? <div className="empty-state"><div className="spinner" /></div> : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr><th>Timestamp</th><th>User</th><th>Action</th><th>Resource</th><th>IP</th></tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr><td colSpan={5}><div className="empty-state">No audit logs found</div></td></tr>
                  ) : logs.map(log => (
                    <tr key={log._id}>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {new Date(log.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{log.user?.name || 'System'}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{log.user?.role || '–'}</div>
                      </td>
                      <td>
                        <span style={{
                          color: actionColors[log.action] || 'var(--text-secondary)',
                          fontWeight: 700, fontSize: '0.78rem',
                          background: `${actionColors[log.action] || 'var(--glass-border)'}15`,
                          padding: '3px 8px', borderRadius: 4,
                        }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        {log.resource}{log.resourceId ? <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}> #{log.resourceId?.slice(-6)}</span> : ''}
                      </td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{log.ipAddress || '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {/* Pagination */}
          {total > limit && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
              <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
              <span style={{ padding: '6px 14px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Page {page} of {Math.ceil(total / limit)}
              </span>
              <button className="btn btn-secondary btn-sm" disabled={page >= Math.ceil(total / limit)} onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
