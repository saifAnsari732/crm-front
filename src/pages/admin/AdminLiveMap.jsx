import React, { useEffect, useState, useRef, useCallback } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import { trackingAPI } from "../../services/api.service";
import { getSocket } from "../../services/socket.service";
import { MapPinned, Users, RefreshCw, History, Search, AlertTriangle, ChevronUp, ChevronDown, X } from "lucide-react";
import toast from "react-hot-toast";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { createLayerComponent } from "@react-leaflet/core";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

const MarkerClusterGroup = createLayerComponent(
  ({ children, ...props }, context) => {
    const instance = new L.MarkerClusterGroup(props);
    return { instance, context: { ...context, layerContainer: instance } };
  }
);

const COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

function createEmployeeIcon(name, color, isActive, avatar, isStationary) {
  const initial = (name || "?")[0].toUpperCase();
  const borderColor = isStationary ? "#f59e0b" : isActive ? "#22c55e" : "#94a3b8";
  const pulseColor = isStationary ? "#f59e0b33" : color + "33";
  const pulseRing = isActive
    ? '<div style="position:absolute;top:-8px;left:-8px;width:52px;height:52px;border-radius:50%;background:' + pulseColor + ';animation:empPulse 2s infinite;"></div>'
    : "";
  const stationaryBadge = isStationary
    ? '<div style="position:absolute;top:-4px;right:-4px;width:16px;height:16px;border-radius:50%;background:#f59e0b;border:2px solid #fff;display:flex;align-items:center;justify-content:center;z-index:10;font-size:9px;">!</div>'
    : "";
  const imgContent = avatar
    ? '<img src="' + avatar + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" onerror="this.outerHTML=\'<div style=&quot;width:100%;height:100%;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px;&quot;>' + initial + '</div>\'" />'
    : '<div style="width:100%;height:100%;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px;">' + initial + "</div>";
  return L.divIcon({
    className: "custom-emp-marker",
    html:
      '<div style="position:relative;width:36px;height:44px;">' +
      pulseRing +
      '<div style="position:relative;z-index:2;width:36px;height:36px;border-radius:50%;background:' + color + ';border:3px solid ' + borderColor + ';box-shadow:0 3px 12px ' + color + '66;overflow:hidden;">' +
      imgContent +
      "</div>" +
      stationaryBadge +
      '<div style="position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:9px solid ' + color + ';"></div>' +
      "</div>",
    iconSize: [36, 44],
    iconAnchor: [18, 44],
    popupAnchor: [0, -46],
  });
}

function createStartIcon() {
  return L.divIcon({
    className: "custom-start-marker",
    html: '<div style="width:26px;height:26px;border-radius:50%;background:#22c55e;border:3px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px #22c55e66;color:#fff;font-size:13px;font-weight:700;">S</div>',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function createCurrentIcon(color) {
  return L.divIcon({
    className: "custom-current-marker",
    html:
      '<div style="position:relative;width:20px;height:20px;">' +
      '<div style="position:absolute;top:-8px;left:-8px;width:36px;height:36px;border-radius:50%;background:' + color + "33;animation:empPulse 1.5s infinite;\"></div>" +
      '<div style="position:relative;z-index:2;width:20px;height:20px;border-radius:50%;background:' + color + ';border:3px solid #fff;box-shadow:0 2px 8px ' + color + '99;"></div>' +
      "</div>",
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

function FlyTo({ center, zoom }) {
  const map = useMap();
  useEffect(() => { if (center) map.flyTo(center, zoom || 14, { duration: 1.2 }); }, [center, zoom, map]);
  return null;
}

const geocodeCache = {};
async function reverseGeocode(lat, lng) {
  const key = lat.toFixed(4) + "," + lng.toFixed(4);
  if (geocodeCache[key]) return geocodeCache[key];
  try {
    const res = await trackingAPI.geocode(lat, lng);
    const address = res.data?.address || "(" + lat.toFixed(4) + ", " + lng.toFixed(4) + ")";
    geocodeCache[key] = address;
    return address;
  } catch {
    return "(" + lat.toFixed(4) + ", " + lng.toFixed(4) + ")";
  }
}

if (!document.getElementById("emp-marker-styles")) {
  const s = document.createElement("style");
  s.id = "emp-marker-styles";
  s.textContent = `
    @keyframes empPulse { 0%{transform:scale(0.6);opacity:0.9} 70%{transform:scale(2);opacity:0} 100%{transform:scale(0.6);opacity:0} }
    .custom-emp-marker,.custom-start-marker,.custom-current-marker{background:none!important;border:none!important;}
    .leaflet-popup-content-wrapper{background:var(--bg-sidebar)!important;backdrop-filter:blur(20px)!important;border:1px solid var(--border-color)!important;border-radius:16px!important;box-shadow:0 8px 32px rgba(0,0,0,0.3)!important;color:var(--text-main)!important;}
    .leaflet-popup-tip{background:var(--bg-sidebar)!important;}
    .leaflet-popup-close-button{color:var(--text-main)!important;font-size:18px!important;top:6px!important;right:8px!important;}
  `;
  document.head.appendChild(s);
}

export default function AdminLiveMap() {
  const [employees, setEmployees] = useState([]);
  const [locations, setLocations] = useState({});
  const [addresses, setAddresses] = useState({});
  const [loading, setLoading] = useState(true);
  const [flyCenter, setFlyCenter] = useState(null);
  const [flyZoom, setFlyZoom] = useState(14);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [selected, setSelected] = useState(null);
  const [stationaryEmps, setStationaryEmps] = useState(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const empColorMap = useRef({});

  const getEmpColor = useCallback((empId) => {
    if (!empColorMap.current[empId]) {
      const idx = Object.keys(empColorMap.current).length;
      empColorMap.current[empId] = COLORS[idx % COLORS.length];
    }
    return empColorMap.current[empId];
  }, []);

  const stats = {
    All: employees.length,
    Active: Object.values(locations).filter(l => l.isActive).length,
    Away: Object.values(locations).filter(l => !l.isActive).length,
    PunchOut: employees.length - Object.keys(locations).length,
    Stationary: stationaryEmps.size,
  };

  const filteredEmployees = employees.filter(emp => {
    const loc = locations[emp._id];
    if (!emp.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (activeFilter === "All") return true;
    if (activeFilter === "Active") return loc?.isActive;
    if (activeFilter === "Away") return loc && !loc.isActive;
    if (activeFilter === "PunchOut") return !loc;
    if (activeFilter === "Stationary") return stationaryEmps.has(String(emp._id));
    return true;
  });

  useEffect(() => {
    fetchLive();
    const socket = getSocket();
    if (socket) {
      socket.on("employee_location", (data) => {
        setLocations(prev => {
          const existing = prev[data.employeeId] || {};
          return { ...prev, [data.employeeId]: { ...existing, ...data, path: [...(existing.path || []), { lat: data.lat, lng: data.lng }] } };
        });
        if (data.address) setAddresses(prev => ({ ...prev, [data.employeeId]: data.address }));
        else fetchAddress(data.employeeId, data.lat, data.lng);
        setStationaryEmps(prev => { const n = new Set(prev); n.delete(String(data.employeeId)); return n; });
      });
      socket.on("employee_stationary", (data) => {
        setStationaryEmps(prev => new Set([...prev, String(data.employeeId)]));
        toast(
          (t) => (
            <div className="flex items-start gap-2">
              <span className="text-amber-400 text-lg">⚠️</span>
              <div>
                <p className="font-black text-sm">{data.name} stationary!</p>
                <p className="text-xs opacity-70">Not moving for 5+ minutes</p>
              </div>
            </div>
          ),
          { duration: 8000, style: { background: "#1a1a1a", color: "#fff", border: "1px solid #f59e0b66" } }
        );
      });
      socket.on("employee_tracking_started", (data) => { fetchLive(); toast.success("📍 " + data.name + " started tracking"); });
      socket.on("employee_tracking_stopped", () => fetchLive());
      socket.on("employee_offline", ({ employeeId }) => {
        setLocations(prev => { const n = { ...prev }; delete n[employeeId]; return n; });
        setStationaryEmps(prev => { const n = new Set(prev); n.delete(String(employeeId)); return n; });
      });
    }
    return () => {
      if (socket) {
        socket.off("employee_location");
        socket.off("employee_stationary");
        socket.off("employee_tracking_started");
        socket.off("employee_tracking_stopped");
        socket.off("employee_offline");
      }
    };
  }, []);

  const fetchAddress = useCallback(async (empId, lat, lng) => {
    const addr = await reverseGeocode(lat, lng);
    setAddresses(prev => ({ ...prev, [empId]: addr }));
  }, []);

  const fetchLive = async () => {
    setLoading(true);
    try {
      const { data } = await trackingAPI.getLive();
      setEmployees(data.employees || []);
      const locMap = {};
      (data.locations || []).forEach(l => {
        if (l.employee && l.coordinates?.length) {
          const last = l.coordinates[l.coordinates.length - 1];
          const path = l.coordinates.map(c => ({ lat: c.lat, lng: c.lng }));
          locMap[l.employee._id] = { ...last, isActive: l.isActive, name: l.employee.name, avatar: l.employee.avatar, department: l.employee.department, totalDistance: l.totalDistance, startTime: l.startTime, path };
          getEmpColor(l.employee._id);
          if (last.address) setAddresses(prev => ({ ...prev, [l.employee._id]: last.address }));
          else fetchAddress(l.employee._id, last.lat, last.lng);
        }
      });
      setLocations(locMap);
      const allLocs = Object.values(locMap);
      if (allLocs.length > 0) {
        const avgLat = allLocs.reduce((s, l) => s + l.lat, 0) / allLocs.length;
        const avgLng = allLocs.reduce((s, l) => s + l.lng, 0) / allLocs.length;
        setFlyCenter([avgLat, avgLng]);
        setFlyZoom(allLocs.length === 1 ? 14 : 10);
      }
    } catch { toast.error("Failed to load live data"); }
    finally { setLoading(false); }
  };

  const handleSelectEmployee = (empId) => {
    const newSelected = empId === selected ? null : empId;
    setSelected(newSelected);
    setSidebarOpen(false);
    if (newSelected && locations[newSelected]) {
      setFlyCenter([locations[newSelected].lat, locations[newSelected].lng]);
      setFlyZoom(15);
    } else {
      const allLocs = Object.values(locations);
      if (allLocs.length > 0) {
        setFlyCenter([allLocs.reduce((s, l) => s + l.lat, 0) / allLocs.length, allLocs.reduce((s, l) => s + l.lng, 0) / allLocs.length]);
        setFlyZoom(allLocs.length === 1 ? 14 : 10);
      }
    }
  };

  const defaultCenter = [26.8467, 80.9462];
  const selectedLoc = selected ? locations[selected] : null;
  const selectedEmp = selected ? employees.find(e => e._id === selected) : null;
  const selectedColor = selected ? getEmpColor(selected) : "#3b82f6";

  return (
    <AdminLayout>
      <div className="p-3 sm:p-4 lg:p-6 space-y-3 max-w-[1800px] mx-auto h-[calc(100vh-56px)] sm:h-[calc(100vh-80px)] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <MapPinned className="w-4 h-4 text-primary-500" />
            <span className="font-black text-[var(--text-main)] text-sm sm:text-base">Live Map</span>
            <span className="text-[10px] font-bold text-[var(--text-muted)] bg-[var(--bg-main)] px-2 py-0.5 rounded-full border border-[var(--border-color)]">{employees.length} tracking</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
              <input type="text" placeholder="Search staff..." className="input-field pl-9 py-1.5 w-48 text-xs" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <button onClick={fetchLive} className="btn-secondary py-1.5 px-3 flex items-center gap-1.5 text-xs">
              <RefreshCw className={"w-3.5 h-3.5 " + (loading ? "animate-spin" : "")} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex overflow-x-auto items-center gap-2 pb-1 hide-scrollbar flex-shrink-0">
          {[
            { id: "All", label: "All", color: "bg-primary-500" },
            { id: "Active", label: "Active", color: "bg-emerald-500" },
            { id: "Away", label: "Away", color: "bg-slate-500" },
            { id: "PunchOut", label: "Punch Out", color: "bg-gray-500" },
            { id: "Stationary", label: "⚠ Stationary", color: "bg-amber-500" },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={"px-3 py-1.5 rounded-xl text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1.5 border whitespace-nowrap flex-shrink-0 " +
                (activeFilter === f.id ? f.color + " text-white border-transparent shadow-lg" : "bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border-color)] hover:border-primary-500/50")
              }
            >
              <span className="uppercase">{f.label}</span>
              <span className={"px-1.5 py-0.5 rounded-full text-[9px] " + (activeFilter === f.id ? "bg-white/20" : "bg-[var(--bg-main)]")}>{stats[f.id]}</span>
            </button>
          ))}
        </div>

        {/* Main */}
        <div className="flex-1 flex flex-col lg:flex-row gap-3 min-h-0 overflow-hidden relative">

          {/* Map Panel */}
          <div className="flex-1 relative flex flex-col overflow-hidden rounded-2xl border border-[var(--border-color)] shadow-2xl" style={{ minHeight: "400px" }}>
            <MapContainer center={flyCenter || defaultCenter} zoom={flyZoom || 5} style={{ height: "100%", minHeight: "400px", width: "100%" }} zoomControl={false}>
              <TileLayer attribution="&copy; Google Maps" url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" subdomains={["mt0", "mt1", "mt2", "mt3"]} />
              {flyCenter && <FlyTo center={flyCenter} zoom={flyZoom} />}

              {/* Markers */}

                {Object.entries(locations).map(([empId, loc]) => {
                  const color = getEmpColor(empId);
                  const empData = employees.find(e => e._id === empId);
                  const isStationary = stationaryEmps.has(String(empId));
                  const isSelected = selected === empId;
                  return (
                    <Marker
                      key={empId}
                      position={[loc.lat, loc.lng]}
                      zIndexOffset={isSelected ? 2000 : isStationary ? 1000 : 0}
                      icon={createEmployeeIcon(loc.name || empData?.name, color, loc.isActive, loc.avatar || empData?.avatar, isStationary)}
                      eventHandlers={{ click: () => handleSelectEmployee(empId) }}
                    >
                      <Popup className="custom-popup">
                        <div className="p-3 min-w-[200px]">
                          <div className="flex items-center gap-2 mb-2">
                            {(loc.avatar || empData?.avatar) ? (
                              <img src={loc.avatar || empData?.avatar} className="w-8 h-8 rounded-lg object-cover" alt={loc.name} />
                            ) : (
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style={{ background: color }}>
                                {(loc.name || "?")[0].toUpperCase()}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-black text-sm text-[var(--text-main)] truncate">{loc.name}</p>
                              <p className="text-[9px] text-[var(--text-muted)]">{loc.department}</p>
                            </div>
                            {isStationary && <span className="text-[9px] font-black text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-full border border-amber-500/20">⚠ Still</span>}
                          </div>
                          <p className="text-[10px] text-[var(--text-muted)] mb-3 leading-relaxed">{addresses[empId] || "Locating..."}</p>
                          <div className="grid grid-cols-2 gap-2 mb-3">
                            <div className="bg-primary-500/10 p-2 rounded-lg text-center">
                              <p className="text-[9px] font-bold text-primary-500 uppercase">Speed</p>
                              <p className="text-xs font-black text-[var(--text-main)]">{Math.round((loc.speed || 0) * 3.6)} km/h</p>
                            </div>
                            <div className="bg-emerald-500/10 p-2 rounded-lg text-center">
                              <p className="text-[9px] font-bold text-emerald-500 uppercase">Today</p>
                              <p className="text-xs font-black text-[var(--text-main)]">{(loc.totalDistance || 0).toFixed(1)} km</p>
                            </div>
                          </div>
                          <button onClick={() => window.location.href = "/admin/tracking-history?employee=" + empId} className="w-full py-2 rounded-xl bg-primary-600/10 hover:bg-primary-600 text-primary-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-primary-500/20">
                            <History className="w-3 h-3" /> View History
                          </button>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}


              {/* Selected path */}
              {selectedLoc && selectedLoc.path?.length > 1 && (
                <>
                  <Polyline positions={selectedLoc.path.map(p => [p.lat, p.lng])} pathOptions={{ color: selectedColor, weight: 14, opacity: 0.12, lineCap: "round" }} />
                  <Polyline positions={selectedLoc.path.map(p => [p.lat, p.lng])} pathOptions={{ color: selectedColor, weight: 5, opacity: 0.95, lineCap: "round", lineJoin: "round" }} />
                  <Polyline positions={selectedLoc.path.map(p => [p.lat, p.lng])} pathOptions={{ color: "#ffffff", weight: 1.5, opacity: 0.6, dashArray: "6, 14", lineCap: "round" }} />
                  <Marker position={[selectedLoc.path[0].lat, selectedLoc.path[0].lng]} icon={createStartIcon()} />
                  <Marker position={[selectedLoc.path[selectedLoc.path.length - 1].lat, selectedLoc.path[selectedLoc.path.length - 1].lng]} icon={createCurrentIcon(selectedColor)} zIndexOffset={3000} />
                </>
              )}
            </MapContainer>

            {/* Floating info card */}
            {selectedLoc && selectedEmp && (
              <div className="absolute top-3 left-3 z-[500] bg-[var(--bg-card)]/95 backdrop-blur-xl rounded-2xl border border-[var(--border-color)] shadow-2xl p-3 w-52 sm:w-60">
                <div className="flex items-center gap-2 mb-2.5">
                  {(selectedLoc.avatar || selectedEmp.avatar) ? (
                    <img src={selectedLoc.avatar || selectedEmp.avatar} className="w-9 h-9 rounded-xl object-cover border-2 flex-shrink-0" style={{ borderColor: selectedColor }} alt={selectedEmp.name} />
                  ) : (
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style={{ background: selectedColor }}>
                      {selectedEmp.name[0].toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-xs text-[var(--text-main)] truncate">{selectedEmp.name}</p>
                    <p className="text-[9px] text-[var(--text-muted)] truncate">{addresses[selected]?.split(",")[0] || "Locating..."}</p>
                  </div>
                  <button onClick={() => setSelected(null)} className="p-1 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0">
                    <X className="w-3 h-3 text-[var(--text-muted)]" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <div className="bg-primary-500/10 rounded-xl p-2 text-center">
                    <p className="text-[8px] font-bold text-primary-500 uppercase">Speed</p>
                    <p className="text-xs font-black text-[var(--text-main)]">{Math.round((selectedLoc.speed || 0) * 3.6)}</p>
                    <p className="text-[8px] text-[var(--text-muted)]">km/h</p>
                  </div>
                  <div className="bg-emerald-500/10 rounded-xl p-2 text-center">
                    <p className="text-[8px] font-bold text-emerald-500 uppercase">Dist</p>
                    <p className="text-xs font-black text-[var(--text-main)]">{(selectedLoc.totalDistance || 0).toFixed(1)}</p>
                    <p className="text-[8px] text-[var(--text-muted)]">km</p>
                  </div>
                  <div className="bg-violet-500/10 rounded-xl p-2 text-center">
                    <p className="text-[8px] font-bold text-violet-500 uppercase">Points</p>
                    <p className="text-xs font-black text-[var(--text-main)]">{selectedLoc.path?.length || 0}</p>
                    <p className="text-[8px] text-[var(--text-muted)]">stops</p>
                  </div>
                </div>
                {stationaryEmps.has(String(selected)) && (
                  <div className="mt-2 flex items-center gap-1.5 bg-amber-500/10 rounded-xl px-2 py-1.5 border border-amber-500/20">
                    <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />
                    <span className="text-[9px] font-black text-amber-500">Stationary 5+ minutes</span>
                  </div>
                )}
              </div>
            )}

            {/* Map Legend */}
            <div className="absolute bottom-8 left-3 z-[500] bg-[var(--bg-card)]/90 backdrop-blur-md rounded-xl border border-[var(--border-color)] shadow-xl p-2.5 space-y-1">
              <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">Legend</p>
              {[
                { color: "bg-emerald-500", label: "Active" },
                { color: "bg-slate-400", label: "Away" },
                { color: "bg-amber-500", label: "Stationary" },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <div className={"w-2.5 h-2.5 rounded-full " + item.color} />
                  <span className="text-[9px] text-[var(--text-main)] font-bold">{item.label}</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[7px] font-bold">S</div>
                <span className="text-[9px] text-[var(--text-main)] font-bold">Start</span>
              </div>
            </div>

            {/* Mobile: show team list button */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden absolute bottom-6 right-3 z-[500] flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white px-4 py-2.5 rounded-2xl shadow-xl text-xs font-black uppercase tracking-widest transition-all"
            >
              <Users className="w-4 h-4" />
              Team ({filteredEmployees.length})
              {sidebarOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
            </button>
          </div>

          {/* Team Directory */}
          <div className={
            "lg:w-80 xl:w-96 glass-card border-[var(--border-color)] flex flex-col overflow-hidden lg:relative " +
            (sidebarOpen
              ? "fixed bottom-0 left-0 right-0 z-[600] rounded-t-3xl max-h-[70vh] shadow-2xl"
              : "hidden lg:flex")
          }>
            {/* Mobile drag handle */}
            <div className="lg:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-12 h-1 rounded-full bg-[var(--border-color)]" />
            </div>

            {/* Header */}
            <div className="p-3 sm:p-4 border-b border-[var(--border-color)] bg-[var(--bg-card)] flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-[var(--text-main)] font-black text-xs uppercase tracking-widest">Team Directory</h3>
                <p className="text-[9px] text-[var(--text-muted)] mt-0.5">{filteredEmployees.length} shown</p>
              </div>
              <div className="flex items-center gap-2">
                {selected && (
                  <button onClick={() => setSelected(null)} className="text-[10px] font-bold text-primary-500 hover:underline">Clear</button>
                )}
                <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 hover:bg-white/10 rounded-lg">
                  <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
                </button>
              </div>
            </div>

            {/* Mobile search */}
            <div className="lg:hidden px-3 pt-2 flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
                <input type="text" placeholder="Search staff..." className="input-field pl-9 py-2 w-full text-xs" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar space-y-1">
              {loading ? (
                [1, 2, 3, 4].map(i => <div key={i} className="h-16 rounded-xl bg-[var(--bg-card)] animate-pulse m-1" />)
              ) : filteredEmployees.length === 0 ? (
                <div className="p-8 text-center text-[var(--text-muted)] text-sm italic">No employees found</div>
              ) : filteredEmployees.map((emp) => {
                const loc = locations[emp._id];
                const color = getEmpColor(emp._id);
                const isSelected = selected === emp._id;
                const isStationary = stationaryEmps.has(String(emp._id));

                return (
                  <div
                    key={emp._id}
                    onClick={() => handleSelectEmployee(emp._id)}
                    className={"group flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border " +
                      (isSelected
                        ? "border-primary-500/40 bg-primary-600/10 shadow-inner shadow-primary-500/10"
                        : "border-transparent hover:bg-[var(--bg-card-hover)] hover:border-[var(--border-color)]")
                    }
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      {emp.avatar ? (
                        <img src={emp.avatar} alt={emp.name} className="w-10 h-10 rounded-xl object-cover" style={{ border: "2px solid " + color }} />
                      ) : (
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-lg" style={{ background: color }}>
                          {emp.name[0].toUpperCase()}
                        </div>
                      )}
                      {loc?.isActive && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[var(--bg-sidebar)]" />}
                      {isStationary && <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 border-2 border-[var(--bg-sidebar)] flex items-center justify-center text-[9px] text-white font-black">!</div>}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-[var(--text-main)] font-bold text-sm truncate">{emp.name}</p>
                        {loc && <span className="text-primary-500 text-[10px] font-black italic flex-shrink-0 ml-1">{(loc.totalDistance || 0).toFixed(1)} km</span>}
                      </div>
                      <p className="text-[var(--text-muted)] text-[10px] font-bold truncate">
                        {loc ? (addresses[emp._id]?.split(",")[0] || "Locating...") : "Not Punched In"}
                      </p>
                      {isStationary && <span className="text-[8px] font-black text-amber-500">⚠ Stationary 5+ min</span>}
                    </div>

                    {loc?.timestamp && (
                      <span className="text-[var(--text-muted)] text-[9px] font-medium flex-shrink-0">
                        {new Date(loc.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}

                    <button
                      onClick={(e) => { e.stopPropagation(); window.location.href = "/admin/tracking-history?employee=" + emp._id; }}
                      className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 bg-[var(--bg-main)] text-[var(--text-muted)] hover:text-primary-500 hover:bg-primary-500/10 transition-all flex-shrink-0"
                      title="View History"
                    >
                      <History className="w-3.5 h-3.5" />
                    </button>
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