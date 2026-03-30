import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import { getUsers, updateUserRole, deactivateUser } from '../../services/api';

const roleColors = { citizen: 'var(--accent-green)', worker: 'var(--accent-orange)', admin: 'var(--accent-blue)', superadmin: 'var(--accent-purple)' };
const roleIcons = { citizen: '👤', worker: '👷', admin: '🧑‍💼', superadmin: '🏛' };

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [changing, setChanging] = useState(null);

  const load = async () => {
    try {
      const res = await getUsers({ ...(filter ? { role: filter } : {}), limit: 100 });
      setUsers(res.data.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filter]);

  const handleRoleChange = async (userId, newRole) => {
    setChanging(userId);
    try { await updateUserRole(userId, newRole); await load(); }
    catch (err) { alert(err.response?.data?.message || 'Failed'); }
    finally { setChanging(null); }
  };

  const handleDeactivate = async (userId) => {
    if (!confirm('Deactivate this user?')) return;
    try { await deactivateUser(userId); await load(); }
    catch (err) { alert('Failed to deactivate'); }
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div>
            <div className="page-title">👥 User Management</div>
            <div className="page-subtitle">Manage roles and access for all system users</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {['', 'citizen', 'worker', 'admin', 'superadmin'].map(r => (
            <button key={r} onClick={() => setFilter(r)}
              className={`btn btn-sm ${filter === r ? 'btn-primary' : 'btn-secondary'}`}>
              {r ? `${roleIcons[r]} ${r}` : '👁 All Roles'}
            </button>
          ))}
        </div>

        <div className="card">
          <div className="card-title">Users ({users.length})</div>
          {loading ? <div className="empty-state"><div className="spinner" /></div> : (
            <div className="table-wrapper">
              <table>
                <thead><tr><th>User</th><th>Role</th><th>Ward</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u._id}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.email}</div>
                      </td>
                      <td>
                        <select
                          value={u.role}
                          onChange={e => handleRoleChange(u._id, e.target.value)}
                          disabled={changing === u._id}
                          style={{
                            background: 'var(--glass)', border: '1px solid var(--glass-border)',
                            borderRadius: 6, padding: '4px 8px', color: roleColors[u.role],
                            fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer'
                          }}
                        >
                          {['citizen', 'worker', 'admin', 'superadmin'].map(r => <option key={r} value={r}>{roleIcons[r]} {r}</option>)}
                        </select>
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>{u.ward || '–'}</td>
                      <td>
                        <span className={`badge ${u.isActive ? 'badge-completed' : 'badge-rejected'}`}>
                          {u.isActive ? '✓ Active' : '✗ Inactive'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {new Date(u.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                      </td>
                      <td>
                        {u.isActive && (
                          <button className="btn btn-danger btn-sm" onClick={() => handleDeactivate(u._id)}>Deactivate</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.length === 0 && <div className="empty-state">No users found</div>}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
