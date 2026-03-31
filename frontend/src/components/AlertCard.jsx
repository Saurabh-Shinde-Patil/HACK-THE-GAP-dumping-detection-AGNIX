import { useState } from 'react';

const sevColors = {
  critical: { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.4)', text: '#ef4444', label: '🔴 Critical' },
  high: { bg: 'rgba(249,115,22,0.15)', border: 'rgba(249,115,22,0.4)', text: '#f97316', label: '🟠 High' },
  medium: { bg: 'rgba(234,179,8,0.15)', border: 'rgba(234,179,8,0.4)', text: '#eab308', label: '🟡 Medium' },
  low: { bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.4)', text: '#22c55e', label: '🟢 Low' },
};

const statusLabels = {
  pending: { icon: '⏳', text: 'Pending', color: '#f59e0b' },
  acknowledged: { icon: '👁️', text: 'Acknowledged', color: '#3b82f6' },
  assigned: { icon: '👷', text: 'Assigned', color: '#8b5cf6' },
  resolved: { icon: '✅', text: 'Resolved', color: '#22c55e' },
  'false-positive': { icon: '❌', text: 'False Positive', color: '#6b7280' },
};

const AlertTracker = ({ status }) => {
  const steps = [
    { id: 'pending', label: 'Detected', icon: '🔴' },
    { id: 'assigned', label: 'Assigned', icon: '👷' },
    { id: 'resolved', label: 'Resolved', icon: '✅' }
  ];
  let currentStepIndex = 0;
  if (status === 'assigned') currentStepIndex = 1;
  if (status === 'resolved') currentStepIndex = 2;
  if (status === 'false-positive') currentStepIndex = -1;

  if (currentStepIndex === -1) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', marginTop: 12, marginBottom: 20, padding: '0 4px', maxWidth: '300px' }}>
      {steps.map((step, index) => {
        const isCompleted = index <= currentStepIndex;
        const isActive = index === currentStepIndex;
        const isLast = index === steps.length - 1;
        
        return (
          <div key={step.id} style={{ display: 'flex', alignItems: 'center', flex: isLast ? 'none' : 1 }}>
            {/* Circle */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isCompleted ? 'var(--accent-blue)' : 'var(--glass)',
                border: isActive ? '2px solid var(--text-primary)' : `2px solid ${isCompleted ? 'var(--accent-blue)' : 'var(--glass-border)'}`,
                color: isCompleted ? '#fff' : 'var(--text-muted)',
                fontSize: '0.8rem', zIndex: 2, transition: 'all 0.3s ease'
              }}>
                {isCompleted ? '✓' : step.icon}
              </div>
              <span style={{ 
                position: 'absolute', top: 30, fontSize: '0.65rem', fontWeight: isActive ? 700 : 500,
                color: isCompleted ? 'var(--accent-blue)' : 'var(--text-muted)', whiteSpace: 'nowrap'
              }}>
                {step.label}
              </span>
            </div>
            {/* Connector Line */}
            {!isLast && (
              <div style={{
                flex: 1, height: 3, margin: '0 4px', borderRadius: 2,
                background: index < currentStepIndex ? 'var(--accent-blue)' : 'var(--glass)',
                transition: 'background 0.3s ease'
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default function AlertCard({ detection, onUpdate, workers = [] }) {
  const [expanded, setExpanded] = useState(false);
  const [assignWorker, setAssignWorker] = useState('');
  const [mapData, setMapData] = useState(null);
  
  const sev = sevColors[detection.severity] || sevColors.medium;
  const st = statusLabels[detection.status] || statusLabels.pending;
  const isNew = detection.status === 'pending' && (Date.now() - new Date(detection.createdAt || detection._alertTs).getTime()) < 60000;

  const handleAction = (status) => {
    const data = { status };
    if (status === 'assigned' && assignWorker) {
      data.assignedTo = assignWorker;
    }
    onUpdate?.(detection._id, data);
  };

  const handleNavigation = () => {
    if (mapData) {
      setMapData(null);
      const btn = document.getElementById(`cctv-nav-${detection._id}`);
      if (btn) btn.innerHTML = '🧭 Navigate';
      return;
    }

    const coords = detection.location?.coordinates;
    if (!coords || coords.length !== 2) {
      alert("Error: CCTV Location coordinates are missing.");
      return;
    }
    const [destLng, destLat] = coords;

    if (!navigator.geolocation) {
      alert("Your browser does not support Geolocation.");
      return;
    }

    const btn = document.getElementById(`cctv-nav-${detection._id}`);
    if (btn) btn.innerHTML = '⏳...';

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (btn) btn.innerHTML = '🧭 Hide Map';
        const { latitude, longitude } = pos.coords;
        const embedUrl = `https://maps.google.com/maps?saddr=${latitude},${longitude}&daddr=${destLat},${destLng}&output=embed`;
        const fullUrl = `https://www.google.com/maps/dir/?api=1&origin=${latitude},${longitude}&destination=${destLat},${destLng}&travelmode=driving`;
        setMapData({ embedUrl, fullUrl });
      },
      (err) => {
        if (btn) btn.innerHTML = '🧭 Navigate';
        alert("Could not get your location. Please enable location permissions.");
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const imageUrl = detection.imageBase64
    ? `data:image/jpeg;base64,${detection.imageBase64}`
    : detection.image || null;

  return (
    <div
      id={`alert-${detection._id}`}
      className={`alert-card ${isNew ? 'alert-card-new' : ''}`}
      style={{
        background: sev.bg,
        border: `1px solid ${sev.border}`,
        borderRadius: 'var(--radius-md, 12px)',
        padding: '16px',
        marginBottom: '12px',
        transition: 'all 0.3s ease',
        animation: isNew ? 'pulse-glow 2s ease-in-out infinite' : 'none',
      }}
    >
      {/* Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        {/* Thumbnail */}
        {imageUrl && (
          <img
            src={imageUrl}
            alt="Detection evidence"
            onClick={() => setExpanded(!expanded)}
            style={{
              width: expanded ? '100%' : 80,
              height: expanded ? 'auto' : 80,
              maxHeight: expanded ? 400 : 80,
              objectFit: 'cover',
              borderRadius: 8,
              cursor: 'pointer',
              border: `2px solid ${sev.border}`,
              transition: 'all 0.3s ease',
            }}
          />
        )}

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px',
              borderRadius: 12, background: sev.border, color: '#fff',
            }}>
              {sev.label}
            </span>
            <span style={{
              fontSize: '0.72rem', fontWeight: 500, padding: '2px 8px',
              borderRadius: 12, background: 'rgba(255,255,255,0.1)', color: st.color,
            }}>
              {st.icon} {st.text}
            </span>
            {isNew && (
              <span style={{
                fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px',
                borderRadius: 12, background: 'rgba(239,68,68,0.8)', color: '#fff',
                animation: 'blink 1s infinite',
              }}>
                🔴 LIVE
              </span>
            )}
          </div>

          <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary, #fff)', marginBottom: '2px' }}>
            📹 {detection.cameraName || 'Unknown Camera'}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #94a3b8)' }}>
            📍 {detection.address || 'CCTV Location'} · {detection.ward || ''}
          </div>

          {/* Confidence bar */}
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', whiteSpace: 'nowrap' }}>
              Confidence:
            </span>
            <div style={{
              flex: 1, height: 6, borderRadius: 3,
              background: 'rgba(255,255,255,0.1)', overflow: 'hidden',
            }}>
              <div style={{
                width: `${(detection.confidence * 100)}%`,
                height: '100%', borderRadius: 3,
                background: `linear-gradient(90deg, ${sev.text}, ${sev.text}88)`,
                transition: 'width 0.5s ease',
              }} />
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: sev.text }}>
              {(detection.confidence * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Timestamp */}
        <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)' }}>
            {new Date(detection.createdAt || detection._alertTs).toLocaleTimeString()}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted, #64748b)' }}>
            {new Date(detection.createdAt || detection._alertTs).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </div>
        </div>
      </div>

      {/* Detected Objects */}
      {detection.detectedObjects?.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {detection.detectedObjects.slice(0, 5).map((obj, i) => (
            <span key={i} style={{
              fontSize: '0.68rem', padding: '2px 6px', borderRadius: 8,
              background: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary, #94a3b8)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}>
              {obj.label} ({(obj.confidence * 100).toFixed(0)}%)
            </span>
          ))}
        </div>
      )}

      {/* Dynamic Tracker */}
      <AlertTracker status={detection.status} />

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
        {detection.status !== 'false-positive' && (
          <button 
            id={`cctv-nav-${detection._id}`}
            className="btn btn-secondary btn-sm" 
            style={{ 
              background: 'rgba(34,197,94,0.15)', color: '#4ade80', 
              border: '1px solid rgba(34,197,94,0.3)', fontWeight: 600,
              padding: '5px 12px', fontSize: '0.75rem', borderRadius: 8
            }}
            onClick={handleNavigation}
          >
            {mapData ? '🧭 Hide Map' : '🧭 Navigate'}
          </button>
        )}

      {detection.status !== 'resolved' && detection.status !== 'false-positive' && (
        <>
          {detection.status === 'pending' && (
            <button
              onClick={() => handleAction('acknowledged')}
              style={{
                padding: '5px 12px', fontSize: '0.75rem', fontWeight: 600,
                border: '1px solid rgba(59,130,246,0.4)', borderRadius: 8,
                background: 'rgba(59,130,246,0.15)', color: '#3b82f6', cursor: 'pointer',
              }}
            >
              👁️ Acknowledge
            </button>
          )}

          <select
            value={assignWorker}
            onChange={(e) => setAssignWorker(e.target.value)}
            style={{
              padding: '5px 8px', fontSize: '0.75rem', borderRadius: 8,
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)',
              color: 'var(--text-primary, #fff)', cursor: 'pointer',
            }}
          >
            <option value="">Assign worker...</option>
            {workers.map(w => (
              <option key={w._id} value={w._id}>{w.name}</option>
            ))}
          </select>

          {assignWorker && (
            <button
              onClick={() => handleAction('assigned')}
              style={{
                padding: '5px 12px', fontSize: '0.75rem', fontWeight: 600,
                border: '1px solid rgba(139,92,246,0.4)', borderRadius: 8,
                background: 'rgba(139,92,246,0.15)', color: '#8b5cf6', cursor: 'pointer',
              }}
            >
              👷 Assign
            </button>
          )}

          <button
            onClick={() => handleAction('resolved')}
            style={{
              padding: '5px 12px', fontSize: '0.75rem', fontWeight: 600,
              border: '1px solid rgba(34,197,94,0.4)', borderRadius: 8,
              background: 'rgba(34,197,94,0.15)', color: '#22c55e', cursor: 'pointer',
            }}
          >
            ✅ Resolve
          </button>

          <button
            onClick={() => handleAction('false-positive')}
            style={{
              padding: '5px 12px', fontSize: '0.75rem', fontWeight: 600,
              border: '1px solid rgba(107,114,128,0.4)', borderRadius: 8,
              background: 'rgba(107,114,128,0.15)', color: '#9ca3af', cursor: 'pointer',
            }}
          >
            ❌ False Positive
          </button>
        </>
      )}
    </div>

    {/* Map Embed Section */}
    {mapData && (
      <div style={{ marginTop: 16, borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
        <div style={{ padding: '8px 12px', background: 'var(--glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>Live Route Directions</span>
          <a href={mapData.fullUrl} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: 'var(--accent-blue)', textDecoration: 'none', fontWeight: 600 }}>
            Open Full Maps ↗
          </a>
        </div>
        <iframe 
          width="100%" 
          height="300" 
          frameBorder="0" 
          style={{ border: 0, display: 'block', background: 'var(--bg-primary)' }} 
          src={mapData.embedUrl} 
          allowFullScreen
        ></iframe>
      </div>
    )}

  </div>
);
}
