import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import { getTasks, updateTask, assignTask, getReports, getWorkers } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const statusBadge = { pending: 'badge-pending', 'in-progress': 'badge-in-progress', completed: 'badge-completed', verified: 'badge-completed' };
const priorityBadge = { low: 'badge-low', medium: 'badge-medium', high: 'badge-high', urgent: 'badge-critical' };

export default function TaskManagement() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [reports, setReports] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assignForm, setAssignForm] = useState({ reportId: '', workerId: '', priority: 'medium', notes: '' });
  const [statusFilter, setStatusFilter] = useState('');
  const [completingId, setCompletingId] = useState(null);
  const [completionFile, setCompletionFile] = useState(null);

  const canAssign = ['admin', 'superadmin'].includes(user?.role);

  const load = async () => {
    try {
      const [tRes, rRes] = await Promise.all([
        getTasks({ limit: 100, ...(statusFilter ? { status: statusFilter } : {}) }),
        canAssign ? getReports({ status: 'pending', limit: 100 }) : Promise.resolve({ data: { data: [] } }),
      ]);
      setTasks(tRes.data.data || []);
      setReports(rRes.data.data || []);
      if (canAssign) {
        const wRes = await getWorkers();
        setWorkers(wRes.data.data || []);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [statusFilter]);

  const handleAssign = async (e) => {
    e.preventDefault();
    setAssigning(true);
    try {
      await assignTask(assignForm);
      setShowAssignForm(false);
      setAssignForm({ reportId: '', workerId: '', priority: 'medium', notes: '' });
      await load();
    } catch (err) { alert(err.response?.data?.message || 'Assignment failed'); }
    finally { setAssigning(false); }
  };

  const handleStatusUpdate = async (taskId, status) => {
    const fd = new FormData();
    fd.append('status', status);
    if (completionFile && completingId === taskId) fd.append('completionImage', completionFile);
    try {
      await updateTask(taskId, fd);
      setCompletingId(null);
      setCompletionFile(null);
      await load();
    } catch (err) { alert('Update failed'); }
  };

  const handleNavigation = (task) => {
    const coords = task.reportId?.location?.coordinates;
    if (!coords || coords.length !== 2) {
      alert("Error: Location coordinates are missing for this task.");
      return;
    }
    const [destLng, destLat] = coords;

    if (!navigator.geolocation) {
      alert("Your browser does not support Geolocation.");
      return;
    }

    const btn = document.getElementById(`nav-btn-${task._id}`);
    if (btn) btn.innerHTML = '⏳ Locating...';

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (btn) btn.innerHTML = '🧭 Get Directions';
        const { latitude, longitude } = pos.coords;
        // Generate a deep link to Google Maps driving directions
        const url = `https://www.google.com/maps/dir/?api=1&origin=${latitude},${longitude}&destination=${destLat},${destLng}&travelmode=driving`;
        window.open(url, '_blank');
      },
      (err) => {
        if (btn) btn.innerHTML = '🧭 Get Directions';
        alert("Could not get your location. Please enable location permissions.");
        console.error(err);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div>
            <div className="page-title">✅ Task Management</div>
            <div className="page-subtitle">
              {canAssign ? 'Assign and monitor cleanup tasks' : 'View and update your assigned tasks'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {canAssign && (
              <button className="btn btn-primary" onClick={() => setShowAssignForm(!showAssignForm)}>
                {showAssignForm ? '✕ Cancel' : '➕ Assign Task'}
              </button>
            )}
            <button className="btn btn-secondary" onClick={load}>🔄 Refresh</button>
          </div>
        </div>

        {/* Assign Task Form */}
        {showAssignForm && canAssign && (
          <div className="card" style={{ marginBottom: 20, borderColor: 'rgba(59,130,246,0.3)' }}>
            <div className="card-title">➕ Assign New Task</div>
            <form onSubmit={handleAssign}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Report</label>
                  <select className="form-select" required value={assignForm.reportId} onChange={e => setAssignForm(p => ({ ...p, reportId: e.target.value }))}>
                    <option value="">-- Select Report --</option>
                    {reports.map(r => <option key={r._id} value={r._id}>{r.address} ({r.severity})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Worker</label>
                  <select className="form-select" required value={assignForm.workerId} onChange={e => setAssignForm(p => ({ ...p, workerId: e.target.value }))}>
                    <option value="">-- Select Worker --</option>
                    {workers.map(w => <option key={w._id} value={w._id}>{w.name} ({w.ward || 'No ward'})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select className="form-select" value={assignForm.priority} onChange={e => setAssignForm(p => ({ ...p, priority: e.target.value }))}>
                    {['low', 'medium', 'high', 'urgent'].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <input className="form-input" placeholder="Additional instructions…"
                    value={assignForm.notes} onChange={e => setAssignForm(p => ({ ...p, notes: e.target.value }))} />
                </div>
              </div>
              <button type="submit" className="btn btn-primary" disabled={assigning}>
                {assigning ? '⏳ Assigning…' : '✅ Assign Task'}
              </button>
            </form>
          </div>
        )}

        {/* Filter */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {['', 'pending', 'in-progress', 'completed', 'verified'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`}>
              {s || '🔍 All'}
            </button>
          ))}
        </div>

        <div className="card">
          <div className="card-title">📋 Tasks ({tasks.length})</div>
          {loading ? <div className="empty-state"><div className="spinner" /></div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {tasks.length === 0 && <div className="empty-state"><div className="empty-icon">📭</div><p>No tasks found</p></div>}
              {tasks.map(task => (
                <div key={task._id} className="card" style={{ padding: '16px 20px', background: 'var(--glass)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                        <span className={`badge ${statusBadge[task.status]}`}>{task.status}</span>
                        <span className={`badge ${priorityBadge[task.priority]}`}>{task.priority}</span>
                      </div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem', marginBottom: 4 }}>
                        📍 {task.reportId?.address || 'Unknown location'}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
                        👷 {task.assignedWorker?.name || '–'} · Ward: {task.reportId?.ward || '–'}
                      </div>
                      {task.notes && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>📝 {task.notes}</div>}
                      
                      {/* Live GPS Navigation for Workers */}
                      {user?.role === 'worker' && task.status !== 'completed' && task.status !== 'verified' && (
                        <div style={{ marginTop: 12 }}>
                          <button 
                            id={`nav-btn-${task._id}`}
                            className="btn btn-secondary btn-sm" 
                            style={{ 
                              background: 'rgba(59,130,246,0.15)', 
                              color: '#60a5fa', 
                              border: '1px solid rgba(59,130,246,0.3)',
                              fontWeight: 600
                            }}
                            onClick={() => handleNavigation(task)}
                          >
                            🧭 Get Directions
                          </button>
                        </div>
                      )}

                      {task.completionImage && (
                        <div style={{ marginTop: 12 }}>
                          <img src={task.completionImage} alt="completed" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6 }} />
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                      {/* Worker updates */}
                      {user?.role === 'worker' && task.status === 'pending' && (
                        <button className="btn btn-secondary btn-sm" onClick={() => handleStatusUpdate(task._id, 'in-progress')}>▶ Start</button>
                      )}
                      {user?.role === 'worker' && task.status === 'in-progress' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {completingId === task._id ? (
                            <>
                              <input type="file" accept="image/*" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}
                                onChange={e => setCompletionFile(e.target.files[0])} />
                              <button className="btn btn-primary btn-sm" onClick={() => handleStatusUpdate(task._id, 'completed')}>✅ Submit</button>
                            </>
                          ) : (
                            <button className="btn btn-primary btn-sm" onClick={() => setCompletingId(task._id)}>✅ Mark Complete</button>
                          )}
                        </div>
                      )}
                      {/* Admin verify */}
                      {canAssign && task.status === 'completed' && (
                        <button className="btn btn-primary btn-sm" onClick={() => handleStatusUpdate(task._id, 'verified')}>🔍 Verify</button>
                      )}
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {new Date(task.createdAt).toLocaleDateString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
