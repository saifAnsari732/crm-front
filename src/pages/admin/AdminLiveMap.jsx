import React, { useEffect, useState, useRef, useCallback } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import { trackingAPI } from '../../services/api.service';
import { getSocket } from '../../services/socket.service';
import { MapPin, Users, Activity, RefreshCw, Navigation, MapPinned, Clock, Locate } from 'lucide-react';
import toast from 'react-hot-toast';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { createLayerComponent } from '@react-leaflet/core';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

// ─── Proper MarkerClusterGroup wrapper for react-leaflet v4 ────────────────
const MarkerClusterGroup = createLayerComponent(
  ({ children, ...props }, context) => {
    const instance = new L.MarkerClusterGroup(props);
    return { instance, context: { ...context, layerContainer: instance } };
  },
);
// Actually, let's just use the markers directly if the count is low, 
// and if high, we'll wrap them.

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

// ─── Reverse geocoding via backend proxy (avoids CORS + rate limits) ─────────
const geocodeCache = {};
const pendingGeocodes = {};
async function reverseGeocode(lat, lng) {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (geocodeCache[key]) return geocodeCache[key];
  if (pendingGeocodes[key]) return pendingGeocodes[key];
  
  const promise = trackingAPI.geocode(lat, lng)
    .then(res => {
      const address = res.data?.address || `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
      geocodeCache[key] = address;
      delete pendingGeocodes[key];
      return address;
    })
    .catch(() => {
      delete pendingGeocodes[key];
      return `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    });
  
  pendingGeocodes[key] = promise;
  return promise;
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
    background: var(--bg-sidebar) !important;
    backdrop-filter: blur(20px) !important;
    border: 1px solid var(--border-color) !important;
    border-radius: 16px !important;
    box-shadow: 0 8px 32px var(--shadow-color) !important;
    color: var(--text-main) !important;
  }
  .leaflet-popup-tip { background: var(--bg-sidebar) !important; }
  .leaflet-popup-close-button { color: var(--text-main) !important; }
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
        // Use backend address if provided, otherwise fetch
        if (data.address) {
          setAddresses(prev => ({ ...prev, [data.employeeId]: data.address }));
        } else {
          fetchAddress(data.employeeId, data.lat, data.lng);
        }
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
          // Use stored address if available
          if (last.address) {
            setAddresses(prev => ({ ...prev, [l.employee._id]: last.address }));
          } else {
            fetchAddress(l.employee._id, last.lat, last.lng);
          }
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
            <h1 className="text-[var(--text-main)] text-2xl font-bold flex items-center gap-3">
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
            <h3 className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider">Field Employees</h3>
            <div className="space-y-2 max-h-[calc(100vh-220px)] overflow-y-auto pr-1 custom-scrollbar">
              {loading ? (
                <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-24 rounded-xl bg-white/5 animate-pulse" />)}</div>
              ) : Object.keys(locations).length === 0 ? (
                <div className="glass-card p-6 text-center">
                  <MapPin className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" />
                  <p className="text-[var(--text-muted)] text-sm">No employees tracking now</p>
                </div>
              ) : Object.entries(locations).map(([empId, loc], idx) => {
                const color = COLORS[idx % COLORS.length];
                const addr = addresses[empId];
                const isSelected = selected === empId;
                return (
                  <div key={empId}
                    onClick={() => handleSelectEmployee(empId)}
                    className={`glass-card p-3.5 cursor-pointer transition-all duration-300 ${isSelected ? 'border-primary-500/50 bg-primary-600/10 shadow-lg shadow-primary-600/10' : 'hover:border-[var(--border-color)] hover:bg-[var(--bg-card-hover)]'}`}>
                    <div className="flex items-center gap-3">
                      {/* Avatar with color indicator */}
                      <div className="relative flex-shrink-0">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center text-[var(--text-main)] font-bold text-sm"
                          style={{ background: `${color}30`, border: `1.5px solid ${color}50` }}>
                          {loc.name?.[0]?.toUpperCase()}
                        </div>
                        <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[var(--bg-main)]" />
                        {/* Color dot to match map marker */}
                        <div className="absolute -bottom-0.5 -left-0.5 w-3 h-3 rounded-full border-2 border-[var(--bg-main)]"
                          style={{ background: color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[var(--text-main)] font-semibold text-sm truncate">{loc.name}</p>
                        <p className="text-[var(--text-muted)] text-xs">{loc.department || 'Staff'}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-emerald-400 text-xs font-semibold">{(loc.totalDistance || 0).toFixed(1)} km</p>
                        <p className="text-[var(--text-muted)] text-xs">{Math.round((loc.speed || 0) * 3.6)} km/h</p>
                      </div>
                    </div>

                    {/* Address section */}
                    <div className="mt-3 p-3 rounded-xl bg-[var(--bg-main)]/50 border border-[var(--border-color)] group-hover:border-primary-500/30 transition-colors">
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5 p-1 rounded bg-primary-500/10 text-primary-500">
                          <MapPin className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          {addr ? (
                            !addr.startsWith('Location') ? (
                              <>
                                <p className="text-[var(--text-main)] text-xs font-bold leading-tight mb-0.5">
                                  {addr.split(',')[0]}
                                </p>
                                {addr.includes(',') && (
                                  <p className="text-[var(--text-muted)] text-[10px] leading-tight line-clamp-2">
                                    {addr.split(',').slice(1).join(',').trim()}
                                  </p>
                                )}
                              </>
                            ) : (
                              <span className="text-[10px] text-[var(--text-muted)] font-mono leading-tight block">{addr}</span>
                            )
                          ) : (
                            <div className="flex flex-col gap-1.5">
                              <div className="h-3 w-3/4 bg-[var(--border-color)] animate-pulse rounded" />
                              <div className="h-2 w-1/2 bg-[var(--border-color)] animate-pulse rounded" />
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {isSelected && loc.path && (
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--border-color)]/50">
                          <div className="flex items-center gap-2">
                            <Navigation className="w-3 h-3 text-primary-500" />
                            <span className="text-[var(--text-main)] text-[10px] font-bold">{loc.path.length} Pings</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-3 h-3 text-[var(--text-muted)]" />
                            <span className="text-[var(--text-muted)] text-[10px] font-medium">
                              Last: {loc.timestamp ? new Date(loc.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--'}
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
                style={{ height: '100%', width: '100%', borderRadius: '16px' }}
                zoomControl={false}
              >
                {/* Dark-themed map tiles */}
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | <a href="https://carto.com/">CARTO</a>'
                  url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                />

                {/* Fly to selected employee */}
                {flyCenter && <FlyTo center={flyCenter} zoom={flyZoom} />}

                <MarkerClusterGroup showCoverageOnHover={false} maxClusterRadius={50}>
                  {Object.entries(locations).map(([empId, loc], idx) => {
                    const emp = employees.find(e => e._id === empId);
                    const color = COLORS[idx % COLORS.length];
                    const isEmpSelected = selected === empId || !selected;
                    const initial = (loc.name || emp?.name || '?')[0].toUpperCase();

                    if (!isEmpSelected && selected) return null;

                    return (
                      <Marker
                        key={empId}
                        position={[loc.lat, loc.lng]}
                        icon={createEmployeeIcon(initial, color, true)}
                        eventHandlers={{ click: () => handleSelectEmployee(empId) }}
                      >
                        <Popup className="custom-popup">
                          <div className="p-2 min-w-[220px]">
                            <div className="flex items-center gap-3 mb-4">
                              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg" 
                                   style={{ background: color, boxShadow: `0 4px 12px ${color}66` }}>
                                {initial}
                              </div>
                              <div>
                                <h4 className="font-bold text-base text-[var(--text-main)]">{loc.name}</h4>
                                <span className="px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-400 text-[10px] font-bold uppercase tracking-wider">
                                  {loc.department || 'Field Staff'}
                                </span>
                              </div>
                            </div>
                            
                            <div className="space-y-3 pt-3 border-t border-[var(--border-color)]">
                              <div className="flex items-start gap-2">
                                <MapPin className="w-4 h-4 text-primary-500 mt-0.5 flex-shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-widest mb-1">Current Address</p>
                                  <p className="text-xs font-semibold text-[var(--text-main)] leading-relaxed">
                                    {addresses[empId] || 'Fetching location...'}
                                  </p>
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-3 pt-1">
                                <div className="bg-[var(--bg-main)]/50 p-2 rounded-xl border border-[var(--border-color)]">
                                  <p className="text-[9px] uppercase font-bold text-[var(--text-muted)] mb-0.5">Distance</p>
                                  <p className="text-xs font-bold text-emerald-400">{(loc.totalDistance || 0).toFixed(2)} km</p>
                                </div>
                                <div className="bg-[var(--bg-main)]/50 p-2 rounded-xl border border-[var(--border-color)]">
                                  <p className="text-[9px] uppercase font-bold text-[var(--text-muted)] mb-0.5">Speed</p>
                                  <p className="text-xs font-bold text-blue-400">{Math.round((loc.speed || 0) * 3.6)} km/h</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </MarkerClusterGroup>

                {/* Render paths with professional glow */}
                {Object.entries(locations).map(([empId, loc], idx) => {
                  const color = COLORS[idx % COLORS.length];
                  const isEmpSelected = selected === empId || !selected;
                  const path = loc.path || [];

                  if (!isEmpSelected && selected) return null;

                  return (
                    <React.Fragment key={`path-${empId}`}>
                      {(selected === empId || activeCount < 10) && path.length > 1 && (
                        <>
                          {/* Path Glow */}
                          <Polyline
                            positions={path.map(p => [p.lat, p.lng])}
                            pathOptions={{
                              color: color,
                              weight: 8,
                              opacity: 0.15,
                              smoothFactor: 2,
                            }}
                          />
                          {/* Main Path Line */}
                          <Polyline
                            positions={path.map(p => [p.lat, p.lng])}
                            pathOptions={{
                              color: color,
                              weight: 3,
                              opacity: 0.8,
                              dashArray: selected === empId ? null : '6, 12',
                              smoothFactor: 1.5,
                              lineCap: 'round',
                            }}
                          />
                        </>
                      )}
                    </React.Fragment>
                  );
                })}
              </MapContainer>


              {/* Map legend overlay */}
              {Object.keys(locations).length > 0 && (
                <div className="absolute top-4 right-4 z-[1000]">
                  <div className="bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-xl p-3 space-y-1.5 min-w-[140px]">
                    <p className="text-[var(--text-muted)] text-[10px] font-semibold uppercase tracking-wider mb-2">Employees</p>
                    {Object.entries(locations).map(([empId, loc], idx) => {
                      const color = COLORS[idx % COLORS.length];
                      return (
                        <div key={empId}
                          onClick={() => handleSelectEmployee(empId)}
                          className={`flex items-center gap-2 cursor-pointer px-2 py-1 rounded-lg transition-all ${selected === empId ? 'bg-[var(--bg-card-hover)]' : 'hover:bg-[var(--bg-card)]'}`}>
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
                          <span className="text-[var(--text-main)] text-xs font-medium truncate">{loc.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* No data overlay */}
              {!loading && Object.keys(locations).length === 0 && (
                <div className="absolute inset-0 z-[999] flex items-center justify-center bg-[var(--bg-main)]/60 backdrop-blur-sm rounded-2xl">
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-2xl bg-primary-600/20 border border-primary-500/30 flex items-center justify-center mx-auto mb-4">
                      <Locate className="w-8 h-8 text-primary-400" />
                    </div>
                    <h3 className="text-[var(--text-main)] font-bold text-lg mb-2">No Active Tracking</h3>
                    <p className="text-[var(--text-muted)] text-sm">Employee routes will appear here when tracking starts</p>
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
