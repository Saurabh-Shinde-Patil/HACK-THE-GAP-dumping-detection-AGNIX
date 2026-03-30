import { useEffect, useRef } from 'react';

// Simple map component using Leaflet directly (avoids react-leaflet version conflicts)
export default function MapView({ reports = [], center = [18.5204, 73.8567], zoom = 12, height = '400px' }) {
  const mapRef = useRef(null);
  const leafletMapRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return;

    // Use global Leaflet from CDN
    const L = window.L;
    if (!L) return;

    const map = L.map(mapRef.current, { center, zoom, zoomControl: true });
    leafletMapRef.current = map;

    // Dark tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors © CARTO',
      maxZoom: 19,
    }).addTo(map);

    return () => { map.remove(); leafletMapRef.current = null; };
  }, []);

  useEffect(() => {
    const L = window.L;
    const map = leafletMapRef.current;
    if (!L || !map) return;

    // Clear existing markers
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker || layer instanceof L.CircleMarker) map.removeLayer(layer);
    });

    const severityColors = { critical: '#dc2626', high: '#ef4444', medium: '#f59e0b', low: '#22c55e' };

    reports.forEach((r) => {
      if (!r.location?.coordinates) return;
      const [lng, lat] = r.location.coordinates;
      const color = severityColors[r.severity] || '#3b82f6';

      const marker = L.circleMarker([lat, lng], {
        radius: r.severity === 'critical' ? 14 : r.severity === 'high' ? 11 : 8,
        fillColor: color,
        color: '#fff',
        weight: 2,
        opacity: 0.9,
        fillOpacity: 0.8,
      }).addTo(map);

      marker.bindPopup(`
        <div style="color:#0a0e1a;min-width:160px;font-family:Inter,sans-serif">
          <strong style="font-size:0.9rem">${r.address || 'Unknown'}</strong><br/>
          <span style="color:${color};font-weight:700;font-size:0.75rem">● ${(r.severity||'').toUpperCase()}</span><br/>
          <span style="color:#666;font-size:0.75rem">${r.status} · ${r.source}</span><br/>
          <span style="color:#666;font-size:0.72rem">${r.ward || ''}</span>
        </div>
      `);
    });
  }, [reports]);

  return (
    <div className="map-container" style={{ height }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
