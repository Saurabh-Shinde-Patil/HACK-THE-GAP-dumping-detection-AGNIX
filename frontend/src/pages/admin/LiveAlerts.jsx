import { useState, useEffect, useCallback } from 'react';
import Sidebar from '../../components/Sidebar';
import AlertCard from '../../components/AlertCard';
import MapView from '../../components/MapView';
import { getDetections, getDetectionStats, updateDetection, getWorkers } from '../../services/api';
import { useSocket } from '../../context/SocketContext';

export default function LiveAlerts() {
  const [detections, setDetections] = useState([]);
  const [stats, setStats] = useState({});
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [sevFilter, setSevFilter] = useState('');
  const { cctvAlerts } = useSocket() || {};

  const load = useCallback(async () => {
    try {
      const params = {};
      if (filter) params.status = filter;
      if (sevFilter) params.severity = sevFilter;

      const [dRes, sRes, wRes] = await Promise.all([
        getDetections({ ...params, limit: 50 }),
        getDetectionStats(),
        getWorkers(),
      ]);
      setDetections(dRes.data.data || []);
      setStats(sRes.data.data || {});
      setWorkers(wRes.data.data || []);
    } catch (e) {
      console.error('Failed to load detections:', e);
    } finally {
      setLoading(false);
    }
  }, [filter, sevFilter]);

  useEffect(() => { load(); }, [load]);

  // Refresh when real-time CCTV alert arrives
  useEffect(() => {
    if (cctvAlerts && cctvAlerts.length > 0) {
      load();
    }
  }, [cctvAlerts, load]);

  const handleUpdate = async (id, data) => {
    try {
      await updateDetection(id, data);
      load();
    } catch (e) {
      console.error('Failed to update detection:', e);
    }
  };

  // Map markers from detections
  const mapReports = detections
    .filter(d => d.location?.coordinates)
    .map(d => ({
      _id: d._id,
      image: d.imageBase64 ? `data:image/jpeg;base64,${d.imageBase64}` : d.image,
      location: d.location,
      address: d.address || d.cameraName,
      severity: d.severity,
      status: d.status,
      ward: d.ward,
      source: 'cctv',
    }));

  // Stat helpers
  const pending = stats.byStatus?.find(s => s._id === 'pending')?.count || 0;
  const resolved = stats.byStatus?.find(s => s._id === 'resolved')?.count || 0;
  const critical = stats.bySeverity?.find(s => s._id === 'critical')?.count || 0;

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div>
            <div className="page-title">📹 Live CCTV Dumping Alerts</div>
            <div className="page-subtitle">Real-time AI-powered illegal dumping surveillance</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={load}>🔄 Refresh</button>
          </div>
        </div>

        {/* Live indicator */}
        {cctvAlerts?.length > 0 && (
          <div style={{
            padding: '10px 16px', marginBottom: 16, borderRadius: 'var(--radius-md, 12px)',
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
            display: 'flex', alignItems: 'center', gap: 10,
            animation: 'pulse-glow 2s ease-in-out infinite',
          }}>
            <span style={{
              width: 10, height: 10, borderRadius: '50%', background: '#ef4444',
              animation: 'blink 1s infinite', display: 'inline-block',
            }} />
            <span style={{ fontWeight: 600, color: '#ef4444', fontSize: '0.88rem' }}>
              {cctvAlerts.length} live alert{cctvAlerts.length > 1 ? 's' : ''} detected
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted, #64748b)' }}>
              · Last: {new Date(cctvAlerts[0]?._alertTs).toLocaleTimeString()}
            </span>
          </div>
        )}

        {/* Stats */}
        <div className="stats-grid">
          {[
            { label: 'Total Detections', value: stats.total || 0, icon: '📹', cls: 'blue' },
            { label: 'Today', value: stats.today || 0, icon: '📅', cls: 'cyan' },
            { label: 'Pending', value: pending, icon: '⏳', cls: 'orange' },
            { label: 'Resolved', value: resolved, icon: '✅', cls: 'green' },
            { label: 'Critical', value: critical, icon: '🔴', cls: 'red' },
            { label: 'Avg Confidence', value: `${((stats.avgConfidence || 0) * 100).toFixed(0)}%`, icon: '🎯', cls: 'purple' },
          ].map(s => (
            <div key={s.label} className={`stat-card ${s.cls}`}>
              <div className="stat-icon">{s.icon}</div>
              <div className="stat-info"><div className="value">{s.value}</div><div className="label">{s.label}</div></div>
            </div>
          ))}
        </div>

        {/* Map */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title">🗺️ Detection Locations</div>
          {!loading && <MapView reports={mapReports} height="320px" />}
        </div>

        {/* Filters */}
        <div className="card">
          <div className="flex-between" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>🚨 Detection Feed</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <select className="form-select" style={{ width: 150 }} value={filter} onChange={e => setFilter(e.target.value)}>
                <option value="">All Status</option>
                {['pending', 'acknowledged', 'assigned', 'resolved', 'false-positive'].map(s =>
                  <option key={s} value={s}>{s}</option>
                )}
              </select>
              <select className="form-select" style={{ width: 140 }} value={sevFilter} onChange={e => setSevFilter(e.target.value)}>
                <option value="">All Severity</option>
                {['critical', 'high', 'medium', 'low'].map(s =>
                  <option key={s} value={s}>{s}</option>
                )}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="empty-state"><div className="spinner" /></div>
          ) : detections.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📹</div>
              <p>No CCTV detections yet</p>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted, #64748b)' }}>
                Start the live monitor to begin receiving alerts
              </p>
            </div>
          ) : (
            <div>
              {detections.map(d => (
                <AlertCard
                  key={d._id}
                  detection={d}
                  onUpdate={handleUpdate}
                  workers={workers}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
