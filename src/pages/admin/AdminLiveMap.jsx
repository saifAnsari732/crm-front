import React, { useEffect, useState, useRef, useCallback } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import { trackingAPI } from '../../services/api.service';
import { getSocket } from '../../services/socket.service';
import { MapPin, Users, Activity, RefreshCw, Navigation, MapPinned, Clock, Locate, History, Search } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);
  const [flyCenter, setFlyCenter] = useState(null);
  const [flyZoom, setFlyZoom] = useState(14);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [selected, setSelected] = useState(null);

  // Derive stats for filters
  const stats = {
    All: employees.length,
    Active: Object.values(locations).filter(l => l.isActive).length,
    Away: Object.values(locations).filter(l => !l.isActive).length,
    PunchOut: employees.length - Object.keys(locations).length,
    NoLocation: employees.filter(e => locations[e._id] && !locations[e._id].lat).length
  };

  const filteredEmployees = employees.filter(emp => {
    const loc = locations[emp._id];
    const matchesSearch = emp.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (activeFilter === 'All') return true;
    if (activeFilter === 'Active') return loc?.isActive;
    if (activeFilter === 'Away') return loc && !loc.isActive;
    if (activeFilter === 'PunchOut') return !loc;
    if (activeFilter === 'NoLocation') return loc && !loc.lat;
    return true;
  });

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

  const defaultCenter = [20.5937, 78.9629]; // India center fallback

  return (
    <AdminLayout>
      <div className="p-4 lg:p-6 space-y-6 max-w-[1800px] mx-auto h-[calc(100vh-80px)] flex flex-col">
        {/* Header & Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm">
             <MapPinned className="w-4 h-4" />
             <span className="font-bold">My Team</span>
          </div>
          <div className="flex items-center gap-3">
             <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input 
                  type="text" 
                  placeholder="Search staff..." 
                  className="input-field pl-10 py-2 w-64 text-sm"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
             </div>
             <button onClick={fetchLive} className="btn-secondary py-2 px-3">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
             </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'All', label: 'All', color: 'bg-primary-500' },
            { id: 'Active', label: 'Active', color: 'bg-emerald-500' },
            { id: 'Away', label: 'Away', color: 'bg-amber-500' },
            { id: 'PunchOut', label: 'Punch Out', color: 'bg-slate-500' },
            { id: 'NoLocation', label: 'No Location', color: 'bg-red-500' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                activeFilter === f.id 
                  ? `${f.color} text-white border-transparent shadow-lg` 
                  : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border-color)] hover:border-primary-500/50'
              }`}
            >
              <span className="uppercase">{f.label}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeFilter === f.id ? 'bg-white/20' : 'bg-[var(--bg-main)]'}`}>
                {stats[f.id]}
              </span>
            </button>
          ))}
        </div>

        <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0 overflow-hidden">
          {/* 1. Map Panel (Left) */}
          <div className="flex-1 glass-card overflow-hidden relative border-[var(--border-color)] shadow-2xl">
            <MapContainer
              center={flyCenter || defaultCenter}
              zoom={flyZoom || 5}
              style={{ height: '100%', width: '100%' }}
              zoomControl={false}
            >
              <TileLayer
                attribution='&copy; Google Maps'
                url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
              />
              {flyCenter && <FlyTo center={flyCenter} zoom={flyZoom} />}
              
              <MarkerClusterGroup showCoverageOnHover={false} maxClusterRadius={40}>
                {Object.entries(locations).map(([empId, loc], idx) => {
                  const color = COLORS[idx % COLORS.length];
                  const initial = (loc.name || '?')[0].toUpperCase();
                  const isSelected = selected === empId;
                  
                  return (
                    <Marker
                      key={empId}
                      position={[loc.lat, loc.lng]}
                      zIndexOffset={isSelected ? 1000 : 0}
                      icon={createEmployeeIcon(initial, color, loc.isActive)}
                      eventHandlers={{ click: () => handleSelectEmployee(empId) }}
                    >
                      <Popup className="custom-popup">
                         <div className="p-3 min-w-[200px]">
                            <p className="font-black text-sm text-[var(--text-main)] mb-1">{loc.name}</p>
                            <p className="text-[10px] text-[var(--text-muted)] mb-3">{addresses[empId] || 'Locating...'}</p>
                            <div className="grid grid-cols-2 gap-2">
                               <div className="bg-primary-500/10 p-2 rounded-lg">
                                  <p className="text-[9px] font-bold text-primary-500 uppercase">Speed</p>
                                  <p className="text-xs font-black text-[var(--text-main)]">{Math.round((loc.speed || 0) * 3.6)} <small>km/h</small></p>
                               </div>
                               <div className="bg-emerald-500/10 p-2 rounded-lg">
                                  <p className="text-[9px] font-bold text-emerald-500 uppercase">Today</p>
                                  <p className="text-xs font-black text-[var(--text-main)]">{(loc.totalDistance || 0).toFixed(1)} <small>km</small></p>
                               </div>
                            </div>
                            <button 
                              onClick={() => window.location.href = `/admin/tracking-history?employee=${empId}`}
                              className="w-full mt-3 py-2 rounded-xl bg-primary-600/10 hover:bg-primary-600 text-primary-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-primary-500/20"
                            >
                               <History className="w-3 h-3" />
                               View History
                            </button>
                         </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MarkerClusterGroup>

              {/* Render paths */}
              {selected && locations[selected]?.path?.length > 1 && (
                <>
                  <Polyline positions={locations[selected].path.map(p => [p.lat, p.lng])} pathOptions={{ color: '#3b82f6', weight: 8, opacity: 0.2 }} />
                  <Polyline positions={locations[selected].path.map(p => [p.lat, p.lng])} pathOptions={{ color: '#3b82f6', weight: 4, opacity: 1, lineCap: 'round' }} />
                </>
              )}
            </MapContainer>
          </div>

          {/* 2. Employee Sidebar (Right) */}
          <div className="w-full lg:w-96 glass-card flex flex-col border-[var(--border-color)] overflow-hidden">
            <div className="p-4 border-b border-[var(--border-color)] bg-[var(--bg-card)] flex items-center justify-between">
              <h3 className="text-[var(--text-main)] font-black text-xs uppercase tracking-widest">Team Directory</h3>
              <span className="text-[10px] font-bold text-primary-500">{filteredEmployees.length} Shown</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar space-y-1">
              {loading ? (
                [1,2,3,4,5].map(i => <div key={i} className="h-16 rounded-xl bg-[var(--bg-card)] animate-pulse m-2" />)
              ) : filteredEmployees.length === 0 ? (
                <div className="p-8 text-center text-[var(--text-muted)] text-sm italic">No matching employees</div>
              ) : filteredEmployees.map((emp, idx) => {
                const loc = locations[emp._id];
                const color = COLORS[idx % COLORS.length];
                const isSelected = selected === emp._id;
                
                return (
                  <div key={emp._id}
                    onClick={() => handleSelectEmployee(emp._id)}
                    className={`group flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                      isSelected ? 'bg-primary-600/10 shadow-inner' : 'hover:bg-[var(--bg-card-hover)]'
                    }`}
                  >
                    <div className="relative">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-lg transition-transform group-hover:scale-105"
                        style={{ background: color }}>
                        {emp.name[0].toUpperCase()}
                      </div>
                      {loc?.isActive && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[var(--bg-sidebar)]" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-[var(--text-main)] font-bold text-sm truncate">{emp.name}</p>
                        {loc && <span className="text-primary-500 text-[10px] font-black italic">{(loc.totalDistance || 0).toFixed(1)} km</span>}
                      </div>
                      <div className="flex items-center justify-between">
                         <p className="text-[var(--text-muted)] text-[10px] font-bold uppercase truncate">
                           {loc ? (addresses[emp._id]?.split(',')[0] || 'Locating...') : 'Not Punch In'}
                         </p>
                         {loc?.timestamp && (
                           <span className="text-[var(--text-muted)] text-[10px] font-medium">
                             {new Date(loc.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                           </span>
                         )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                       <button 
                        onClick={(e) => { e.stopPropagation(); window.location.href = `/admin/tracking-history?employee=${emp._id}`; }}
                        className="p-1.5 rounded-lg bg-[var(--bg-main)] text-[var(--text-muted)] hover:text-primary-500 hover:bg-primary-500/10 transition-all"
                        title="View History"
                       >
                          <History className="w-3.5 h-3.5" />
                       </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
