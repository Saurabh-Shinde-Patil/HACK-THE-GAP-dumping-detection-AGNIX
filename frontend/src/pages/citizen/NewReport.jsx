import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import { createReport } from '../../services/api';

export default function NewReport() {
  const navigate = useNavigate();
  const fileRef = useRef();
  const [form, setForm] = useState({ description: '', ward: '', address: '' });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [location, setLocation] = useState({ lat: null, lng: null });
  const [locLoading, setLocLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);

  const handleFile = (f) => {
    if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = e => setPreview(e.target.result);
    reader.readAsDataURL(f);
  };

  const fetchLocation = () => {
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocLoading(false);
      },
      err => {
        // Fallback to Pune city center
        setLocation({ lat: 18.5204, lng: 73.8567 });
        setLocLoading(false);
      }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return setError('Please select an image');
    if (!location.lat) return setError('Please capture your location first');
    setError('');
    setSubmitting(true);

    try {
      const fd = new FormData();
      fd.append('image', file);
      fd.append('latitude', location.lat);
      fd.append('longitude', location.lng);
      fd.append('description', form.description);
      fd.append('ward', form.ward);
      fd.append('address', form.address);
      fd.append('source', 'citizen');

      const res = await createReport(fd);
      setSuccess(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="app-layout">
        <Sidebar />
        <main className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ textAlign: 'center', maxWidth: 480, margin: 'auto' }}>
            <div style={{ fontSize: '4rem', marginBottom: '16px' }}>✅</div>
            <h2 style={{ fontFamily: 'Outfit', marginBottom: '8px' }}>Report Submitted!</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
              {success.detectionDetails?.detected
                ? `AI detected garbage with ${Math.round(success.detectionConfidence * 100)}% confidence. Severity: ${success.severity}`
                : 'Your report has been submitted for manual review.'}
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={() => navigate('/')}>View My Reports</button>
              <button className="btn btn-secondary" onClick={() => { setSuccess(null); setFile(null); setPreview(null); }}>Submit Another</button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div>
            <div className="page-title">📸 Report Garbage</div>
            <div className="page-subtitle">Upload an image and your location will be auto-tagged</div>
          </div>
        </div>

        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          {error && <div className="toast error" style={{ marginBottom: 16, position: 'relative', animation: 'none' }}>❌ {error}</div>}

          <form onSubmit={handleSubmit}>
            {/* Image Upload */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-title">📷 Upload Image</div>
              {preview ? (
                <div style={{ position: 'relative' }}>
                  <img src={preview} alt="preview" className="report-img" style={{ height: 260 }} />
                  <button type="button" className="btn btn-danger btn-sm"
                    style={{ position: 'absolute', top: 10, right: 10 }}
                    onClick={() => { setFile(null); setPreview(null); }}>✕ Remove</button>
                </div>
              ) : (
                <div
                  className={`upload-zone ${dragging ? 'active' : ''}`}
                  onClick={() => fileRef.current.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
                >
                  <div className="upload-icon">📸</div>
                  <h3>Drop image here or click to browse</h3>
                  <p>JPEG, PNG, WebP · Max 10MB</p>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
            </div>

            {/* Location */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-title">📍 Location</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <button type="button" className="btn btn-secondary" onClick={fetchLocation} disabled={locLoading}>
                  {locLoading ? '⏳ Fetching…' : '📍 Auto-detect GPS'}
                </button>
                {location.lat && (
                  <span style={{ color: 'var(--accent-green)', fontSize: '0.85rem', fontWeight: 600 }}>
                    ✓ {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                  </span>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Address (description)</label>
                  <input className="form-input" placeholder="e.g., Near FC Road bus stop"
                    value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Ward</label>
                  <input className="form-input" placeholder="e.g., Ward-1"
                    value={form.ward} onChange={e => setForm(p => ({ ...p, ward: e.target.value }))} />
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-title">📝 Details</div>
              <div className="form-group">
                <label className="form-label">Description (optional)</label>
                <textarea className="form-textarea" placeholder="Describe the garbage situation, e.g., large pile of waste blocking road"
                  value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
              </div>
            </div>

            <button type="submit" disabled={submitting} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '14px' }}>
              {submitting ? '🤖 AI is analyzing image…' : '🚀 Submit Report'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
