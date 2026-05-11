import React, { useEffect, useState, useRef, useCallback } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import { trackingAPI } from '../../services/api.service';
import { getSocket } from '../../services/socket.service';
import { MapPin, Users, Activity, RefreshCw, Navigation, MapPinned, Clock, Locate } from 'lucide-react';
import toast from 'react-hot-toast';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';

// ─── Custom marker icon creator ─────────────────────────────────────────────
const COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
 
function createEmployeeIcon(initial, color, isActive) {
  const pulseRing = isActive
    ? `<div style="position:absolute;top:-6px;left:-6px;width:44px;height:44px;border-radius:50%;background:${color}33;animation:empPulse 2s infinite;"></div>`
    : ''; 
  return L.divIcon({
    className: 'custom-emp-marker',
    html: `
      <div style="position:relative;width:32px;height:32px;">
        ${pulseRing}
        <div style="position:relative;z-index:2;width:32px;height:32px;border-radius:50%;background:${color};border:3px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:13px;font-family:'Plus Jakarta Sans',sans-serif;box-shadow:0 2px 8px ${color}66;">
          ${initial}
        </div>
        <div style="position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid ${color};"></div>
      </div>`,
    iconSize: [32, 42],
    iconAnchor: [16, 42],
    popupAnchor: [0, -44],
  });
}

// ─── Numbered waypoint icon ──────────────────────────────────────────────────
function createWaypointIcon(number, color) {
  return L.divIcon({
    className: 'custom-waypoint',
    html: `<div style="width:22px;height:22px;border-radius:50%;background:${color};border:2px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:10px;font-family:'Plus Jakarta Sans',sans-serif;box-shadow:0 1px 4px rgba(0,0,0,0.3);">${number}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

// ─── Map re-center component ─────────────────────────────────────────────────
function FlyTo({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, zoom || 14, { duration: 1.2 });
  }, [center, zoom, map]);
  return null;
}

// ─── Reverse geocoding cache ─────────────────────────────────────────────────
const geocodeCache = {};
async function reverseGeocode(lat, lng) {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (geocodeCache[key]) return geocodeCache[key];
  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await resp.json();
    if (data?.address) {
      const a = data.address;
      const parts = [
        a.road || a.neighbourhood || a.suburb || '',
        a.city || a.town || a.village || a.county || '',
        a.state || '',
        a.postcode || '',
      ].filter(Boolean);
      const formatted = parts.join(', ');
      geocodeCache[key] = formatted;
      return formatted;
    }
    return data?.display_name?.split(',').slice(0, 3).join(',') || 'Unknown location';
  } catch {
    return 'Address unavailable';
  }
}

// ─── Pulse animation style ──────────────────────────────────────────────────
const pulseStyle = document.createElement('style');
pulseStyle.textContent = `
  @keyframes empPulse {
    0% { transform: scale(0.7); opacity: 0.8; }
    70% { transform: scale(1.8); opacity: 0; }
    100% { transform: scale(0.7); opacity: 0; }
  }
  .custom-emp-marker, .custom-waypoint { background: none !important; border: none !important; }
  .leaflet-popup-content-wrapper {
    background: rgba(15, 23, 42, 0.95) !important;
    backdrop-filter: blur(20px) !important;
    border: 1px solid rgba(255,255,255,0.15) !important;
    border-radius: 16px !important;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5) !important;
    color: #fff !important;
  }
  .leaflet-popup-tip { background: rgba(15, 23, 42, 0.95) !important; }
  .leaflet-popup-close-button { color: #fff !important; }
`;
if (!document.getElementById('emp-marker-styles')) {
  pulseStyle.id = 'emp-marker-styles';
  document.head.appendChild(pulseStyle);
}

export default function AdminLiveMap() {
  const [employees, setEmployees] = useState([]);
  const [locations, setLocations] = useState({});   // { empId: { lat, lng, name, speed, totalDistance, path: [{lat,lng}], avatar } }
  const [addresses, setAddresses] = useState({});    // { empId: "formatted address" }
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [flyCenter, setFlyCenter] = useState(null);
  const [flyZoom, setFlyZoom] = useState(14);
  const mapRef = useRef(null);

  // ─── Socket & data fetch ───────────────────────────────────────────────────
  useEffect(() => {
    fetchLive();
    const socket = getSocket();
    if (socket) {
      socket.on('employee_location', (data) => {
        setLocations(prev => {
          const existing = prev[data.employeeId] || {};
          const prevPath = existing.path || [];
          return {
            ...prev,
            [data.employeeId]: {
              ...existing,
              ...data,
              path: [...prevPath, { lat: data.lat, lng: data.lng }],
            },
          };
        });
        // Refresh address for this employee
        fetchAddress(data.employeeId, data.lat, data.lng);
      });
      socket.on('employee_tracking_started', (data) => {
        fetchLive();
        toast.success(`📍 ${data.name} started tracking`);
      });
      socket.on('employee_tracking_stopped', (data) => {
        fetchLive();
      });
      socket.on('employee_offline', ({ employeeId }) => {
        setLocations(prev => { const n = { ...prev }; delete n[employeeId]; return n; });
      });
    }
    return () => {
      if (socket) {
        socket.off('employee_location');
        socket.off('employee_tracking_started');
        socket.off('employee_tracking_stopped');
        socket.off('employee_offline');
      }
    };
  }, []);

  const fetchAddress = useCallback(async (empId, lat, lng) => {
    const addr = await reverseGeocode(lat, lng);
    setAddresses(prev => ({ ...prev, [empId]: addr }));
  }, []);

  const fetchLive = async () => {
    try {
      const { data } = await trackingAPI.getLive();
      setEmployees(data.employees || []);
      const locMap = {};
      (data.locations || []).forEach(l => {
        if (l.employee && l.coordinates?.length) {
          const last = l.coordinates[l.coordinates.length - 1];
          const path = l.coordinates.map(c => ({ lat: c.lat, lng: c.lng }));
          locMap[l.employee._id] = {
            ...last,
            name: l.employee.name,
            avatar: l.employee.avatar,
            department: l.employee.department,
            totalDistance: l.totalDistance,
            path,
          };
          // Fetch address for each employee
          fetchAddress(l.employee._id, last.lat, last.lng);
        }
      });
      setLocations(locMap);

      // Auto-center map on first load
      const allLocs = Object.values(locMap);
      if (allLocs.length > 0) {
        const avgLat = allLocs.reduce((s, l) => s + l.lat, 0) / allLocs.length;
        const avgLng = allLocs.reduce((s, l) => s + l.lng, 0) / allLocs.length;
        setFlyCenter([avgLat, avgLng]);
        setFlyZoom(allLocs.length === 1 ? 14 : 10);
      }
    } catch { toast.error('Failed to load live data'); }
    finally { setLoading(false); }
  };

  const handleSelectEmployee = (empId) => {
    const newSelected = empId === selected ? null : empId;
    setSelected(newSelected);
    if (newSelected && locations[newSelected]) {
      setFlyCenter([locations[newSelected].lat, locations[newSelected].lng]);
      setFlyZoom(15);
    } else if (!newSelected) {
      // Zoom out to show all
      const allLocs = Object.values(locations);
      if (allLocs.length > 0) {
        const avgLat = allLocs.reduce((s, l) => s + l.lat, 0) / allLocs.length;
        const avgLng = allLocs.reduce((s, l) => s + l.lng, 0) / allLocs.length;
        setFlyCenter([avgLat, avgLng]);
        setFlyZoom(allLocs.length === 1 ? 14 : 10);
      }
    }
  };

  const activeCount = Object.keys(locations).length;
  const defaultCenter = [20.5937, 78.9629]; // India center fallback

  return (
    <AdminLayout>
      <div className="p-4 lg:p-6 space-y-5 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white text-2xl font-bold flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-600/30 border border-primary-500/30 flex items-center justify-center">
                <MapPinned className="w-5 h-5 text-primary-400" />
              </div>
              Live Tracking
            </h1>
            <div className="flex items-center gap-2 mt-1.5 ml-[52px]">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-emerald-400 text-sm font-medium">{activeCount} employee{activeCount !== 1 ? 's' : ''} tracking live</p>
            </div>
          </div>
          <button onClick={fetchLive} className="btn-ghost flex items-center gap-2 py-2 px-4 text-sm">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* ─── Employee list (left sidebar) ─────────────────────────────── */}
          <div className="lg:col-span-4 xl:col-span-3 space-y-3">
            <h3 className="text-white/60 text-xs font-semibold uppercase tracking-wider">Field Employees</h3>
            <div className="space-y-2 max-h-[calc(100vh-220px)] overflow-y-auto pr-1 custom-scrollbar">
              {loading ? (
                <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-24 rounded-xl bg-white/5 animate-pulse" />)}</div>
              ) : Object.keys(locations).length === 0 ? (
                <div className="glass-card p-6 text-center">
                  <MapPin className="w-8 h-8 text-white/20 mx-auto mb-2" />
                  <p className="text-white/40 text-sm">No employees tracking now</p>
                </div>
              ) : Object.entries(locations).map(([empId, loc], idx) => {
                const color = COLORS[idx % COLORS.length];
                const addr = addresses[empId];
                const isSelected = selected === empId;
                return (
                  <div key={empId}
                    onClick={() => handleSelectEmployee(empId)}
                    className={`glass-card p-3.5 cursor-pointer transition-all duration-300 ${isSelected ? 'border-primary-500/50 bg-primary-600/10 shadow-lg shadow-primary-600/10' : 'hover:border-white/20 hover:bg-white/[0.03]'}`}>
                    <div className="flex items-center gap-3">
                      {/* Avatar with color indicator */}
                      <div className="relative flex-shrink-0">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                          style={{ background: `${color}30`, border: `1.5px solid ${color}50` }}>
                          {loc.name?.[0]?.toUpperCase()}
                        </div>
                        <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-dark-900" />
                        {/* Color dot to match map marker */}
                        <div className="absolute -bottom-0.5 -left-0.5 w-3 h-3 rounded-full border-2 border-dark-900"
                          style={{ background: color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-sm truncate">{loc.name}</p>
                        <p className="text-white/40 text-xs">{loc.department || 'Field'}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-emerald-400 text-xs font-semibold">{(loc.totalDistance || 0).toFixed(1)} km</p>
                        <p className="text-white/30 text-xs">{Math.round((loc.speed || 0) * 3.6)} km/h</p>
                      </div>
                    </div>

                    {/* Address section */}
                    <div className="mt-2.5 pt-2.5 border-t border-white/[0.07]">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 text-primary-400 mt-0.5 flex-shrink-0" />
                        <p className="text-white/60 text-xs leading-relaxed">
                          {addr || 'Fetching address...'}
                        </p>
                      </div>
                      {isSelected && loc.path && (
                        <div className="flex items-center gap-3 mt-2">
                          <div className="flex items-center gap-1.5">
                            <Navigation className="w-3 h-3 text-white/30" />
                            <span className="text-white/30 text-[10px]">{loc.path.length} points</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-white/30" />
                            <span className="text-white/30 text-[10px]">
                              {loc.timestamp ? new Date(loc.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ─── Interactive Map ───────────────────────────────────────────── */}
          <div className="lg:col-span-8 xl:col-span-9">
            <div className="glass-card overflow-hidden" style={{ height: 'calc(100vh - 180px)', minHeight: '500px' }}>
              <MapContainer
                center={flyCenter || defaultCenter}
                zoom={flyZoom || 5}
                ref={mapRef}
                style={{ height: '100%', width: '100%', borderRadius: '16px' }}
                zoomControl={false}
              >
                {/* Dark-themed map tiles */}
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | <a href="https://carto.com/">CARTO</a>'
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />

                {/* Fly to selected employee */}
                {flyCenter && <FlyTo center={flyCenter} zoom={flyZoom} />}

                {/* Render each employee */}
                {Object.entries(locations).map(([empId, loc], idx) => {
                  const emp = employees.find(e => e._id === empId);
                  const color = COLORS[idx % COLORS.length];
                  const isEmpSelected = selected === empId || !selected;
                  const initial = (loc.name || emp?.name || '?')[0].toUpperCase();
                  const path = loc.path || [];

                  if (!isEmpSelected && selected) return null;

                  return (
                    <React.Fragment key={empId}>
                      {/* Route trail polyline */}
                      {path.length > 1 && (
                        <Polyline
                          positions={path.map(p => [p.lat, p.lng])}
                          pathOptions={{
                            color: color,
                            weight: 4,
                            opacity: 0.8,
                            dashArray: selected === empId ? null : '8, 8',
                            lineCap: 'round',
                            lineJoin: 'round',
                          }}
                        />
                      )}

                      {/* Numbered waypoints along the path (show every ~10th point) */}
                      {selected === empId && path.length > 2 && (() => {
                        const step = Math.max(1, Math.floor(path.length / 8));
                        const waypoints = [];
                        for (let i = 0; i < path.length - 1; i += step) {
                          waypoints.push({ ...path[i], num: waypoints.length + 1 });
                        }
                        return waypoints.map((wp, wi) => (
                          <Marker
                            key={`wp-${empId}-${wi}`}
                            position={[wp.lat, wp.lng]}
                            icon={createWaypointIcon(wp.num, color)}
                          />
                        ));
                      })()}

                      {/* Current position marker */}
                      <Marker
                        position={[loc.lat, loc.lng]}
                        icon={createEmployeeIcon(initial, color, true)}
                        eventHandlers={{
                          click: () => handleSelectEmployee(empId),
                        }}
                      >
                        <Popup>
                          <div style={{ minWidth: '200px', padding: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                              <div style={{
                                width: '36px', height: '36px', borderRadius: '10px',
                                background: `${color}30`, border: `2px solid ${color}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: '#fff', fontWeight: 700, fontSize: '14px'
                              }}>{initial}</div>
                              <div>
                                <div style={{ color: '#fff', fontWeight: 600, fontSize: '14px' }}>{loc.name || emp?.name}</div>
                                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px' }}>{emp?.department || 'Field'}</div>
                              </div>
                            </div>
                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '8px' }}>
                              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', marginBottom: '4px' }}>
                                📍 {addresses[empId] || 'Fetching...'}
                              </div>
                              <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                                <span style={{ color: '#22c55e', fontSize: '12px', fontWeight: 600 }}>
                                  {(loc.totalDistance || 0).toFixed(1)} km
                                </span>
                                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
                                  {Math.round((loc.speed || 0) * 3.6)} km/h
                                </span>
                              </div>
                            </div>
                          </div>
                        </Popup>
                      </Marker>

                      {/* Start point marker */}
                      {path.length > 1 && (
                        <Marker
                          position={[path[0].lat, path[0].lng]}
                          icon={createWaypointIcon('S', color)}
                        >
                          <Popup>
                            <div style={{ color: '#fff', fontSize: '12px' }}>
                              <strong>Start Point</strong> — {loc.name || emp?.name}
                            </div>
                          </Popup>
                        </Marker>
                      )}
                    </React.Fragment>
                  );
                })}
              </MapContainer>

              {/* Map legend overlay */}
              {Object.keys(locations).length > 0 && (
                <div className="absolute top-4 right-4 z-[1000]">
                  <div className="bg-dark-900/90 backdrop-blur-xl border border-white/10 rounded-xl p-3 space-y-1.5 min-w-[140px]">
                    <p className="text-white/40 text-[10px] font-semibold uppercase tracking-wider mb-2">Employees</p>
                    {Object.entries(locations).map(([empId, loc], idx) => {
                      const color = COLORS[idx % COLORS.length];
                      return (
                        <div key={empId}
                          onClick={() => handleSelectEmployee(empId)}
                          className={`flex items-center gap-2 cursor-pointer px-2 py-1 rounded-lg transition-all ${selected === empId ? 'bg-white/10' : 'hover:bg-white/5'}`}>
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
                          <span className="text-white text-xs font-medium truncate">{loc.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* No data overlay */}
              {!loading && Object.keys(locations).length === 0 && (
                <div className="absolute inset-0 z-[999] flex items-center justify-center bg-dark-900/60 backdrop-blur-sm rounded-2xl">
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-2xl bg-primary-600/20 border border-primary-500/30 flex items-center justify-center mx-auto mb-4">
                      <Locate className="w-8 h-8 text-primary-400" />
                    </div>
                    <h3 className="text-white font-bold text-lg mb-2">No Active Tracking</h3>
                    <p className="text-white/40 text-sm">Employee routes will appear here when tracking starts</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
