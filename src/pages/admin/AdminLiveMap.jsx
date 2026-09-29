import React, { useEffect, useState, useRef, useCallback } from "react";
import TrackProLayout from "../../components/layout/TrackProLayout";
import { trackingAPI } from "../../services/api.service";
import { getSocket } from "../../services/socket.service";
import {
  MapPinned,
  Users,
  RefreshCw,
  History,
  Search,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  X,
  Phone,
  Mail,
  Navigation,
  Clock,
  Gauge,
  Route,
  MapPin,
  Calendar,
  CheckCircle2,
  Radio,
  ExternalLink,
  Activity,
  Play,
  Sparkles,
  Shield,
  Layers,
  Maximize2
} from "lucide-react";
import toast from "react-hot-toast";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { createLayerComponent } from "@react-leaflet/core";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

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
    html: '<div style="width:28px;height:28px;border-radius:50%;background:#10b981;border:3px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(16,185,129,0.5);color:#fff;font-size:12px;font-weight:800;">S</div>',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function createCurrentIcon(color) {
  return L.divIcon({
    className: "custom-current-marker",
    html:
      '<div style="position:relative;width:22px;height:22px;">' +
      '<div style="position:absolute;top:-7px;left:-7px;width:36px;height:36px;border-radius:50%;background:' + color + '44;animation:empPulse 1.5s infinite;"></div>' +
      '<div style="position:relative;z-index:2;width:22px;height:22px;border-radius:50%;background:' + color + ';border:3px solid #fff;box-shadow:0 3px 12px ' + color + 'aa;"></div>' +
      "</div>",
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function FlyTo({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.flyTo(center, zoom || 14, { duration: 1.2 });
    }
  }, [center, zoom, map]);
  return null;
}

const geocodeCache = {};
async function reverseGeocode(lat, lng) {
  const key = Number(lat).toFixed(4) + "," + Number(lng).toFixed(4);
  if (geocodeCache[key]) return geocodeCache[key];
  try {
    const res = await trackingAPI.geocode(lat, lng);
    const address = res.data?.address || "(" + Number(lat).toFixed(4) + ", " + Number(lng).toFixed(4) + ")";
    geocodeCache[key] = address;
    return address;
  } catch {
    return "(" + Number(lat).toFixed(4) + ", " + Number(lng).toFixed(4) + ")";
  }
}

// Format duration from start time to now
function formatTravelDuration(startTime) {
  if (!startTime) return "0m";
  const start = new Date(startTime).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - start);
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

if (typeof document !== "undefined" && !document.getElementById("emp-marker-styles")) {
  const s = document.createElement("style");
  s.id = "emp-marker-styles";
  s.textContent = `
    @keyframes empPulse { 0%{transform:scale(0.6);opacity:0.9} 70%{transform:scale(2);opacity:0} 100%{transform:scale(0.6);opacity:0} }
    .custom-emp-marker,.custom-start-marker,.custom-current-marker{background:none!important;border:none!important;}
    .leaflet-popup-content-wrapper{background:var(--bg-card,#1e293b)!important;backdrop-filter:blur(20px)!important;border:1px solid var(--border-color,rgba(255,255,255,0.1))!important;border-radius:18px!important;box-shadow:0 12px 40px rgba(0,0,0,0.35)!important;color:var(--text-main,#fff)!important;}
    .leaflet-popup-tip{background:var(--bg-card,#1e293b)!important;}
    .leaflet-popup-close-button{color:var(--text-main,#fff)!important;font-size:18px!important;top:8px!important;right:10px!important;}
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
  // Default to 'Active' so only tracking employees are highlighted/shown by default
  const [activeFilter, setActiveFilter] = useState("Active");
  const [selected, setSelected] = useState(null);
  const [stationaryEmps, setStationaryEmps] = useState(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const empColorMap = useRef({});

  const getEmpColor = useCallback((empId) => {
    const id = String(empId);
    if (!empColorMap.current[id]) {
      const idx = Object.keys(empColorMap.current).length;
      empColorMap.current[id] = COLORS[idx % COLORS.length];
    }
    return empColorMap.current[id];
  }, []);

  // Employees actively tracking
  const trackingEmployees = employees.filter(emp => {
    const empIdStr = String(emp._id);
    const loc = locations[empIdStr] || locations[emp._id];
    return emp.isTracking || (loc && loc.isActive);
  });

  const teamList = employees;

  const stats = {
    Active: teamList.filter(emp => {
      const empIdStr = String(emp._id);
      const loc = locations[empIdStr] || locations[emp._id];
      return loc?.isActive || emp.isTracking;
    }).length,
    All: teamList.length,
    Away: teamList.filter(emp => {
      const empIdStr = String(emp._id);
      const loc = locations[empIdStr] || locations[emp._id];
      return !loc?.isActive && !emp.isTracking;
    }).length,
    Stationary: Array.from(stationaryEmps).filter(empId => teamList.some(e => String(e._id) === String(empId))).length,
  };

  const filteredEmployees = teamList.filter(emp => {
    const empIdStr = String(emp._id);
    const loc = locations[empIdStr] || locations[emp._id];
    const matchesSearch = emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (emp.department && emp.department.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (emp.employeeId && emp.employeeId.toLowerCase().includes(searchQuery.toLowerCase()));
    if (!matchesSearch) return false;

    if (activeFilter === "Active") return loc?.isActive || emp.isTracking;
    if (activeFilter === "All") return true;
    if (activeFilter === "Away") return !loc?.isActive && !emp.isTracking;
    if (activeFilter === "Stationary") return stationaryEmps.has(empIdStr);
    return true;
  });

  useEffect(() => {
    fetchLive();
    const socket = getSocket();
    if (socket) {
      socket.on("employee_location", (data) => {
        const empIdStr = String(data.employeeId);
        setLocations(prev => {
          const existing = prev[empIdStr] || prev[data.employeeId] || {};
          return {
            ...prev,
            [empIdStr]: {
              ...existing,
              ...data,
              isActive: true,
              path: [...(existing.path || []), { lat: data.lat, lng: data.lng, timestamp: new Date() }]
            }
          };
        });
        if (data.address) setAddresses(prev => ({ ...prev, [empIdStr]: data.address }));
        else fetchAddress(empIdStr, data.lat, data.lng);
        setStationaryEmps(prev => { const n = new Set(prev); n.delete(empIdStr); return n; });
      });

      socket.on("employee_stationary", (data) => {
        setStationaryEmps(prev => new Set([...prev, String(data.employeeId)]));
        toast(
          (t) => (
            <div className="flex items-start gap-2">
              <span className="text-amber-400 text-lg">⚠️</span>
              <div>
                <p className="font-black text-sm">{data.name} is stationary</p>
                <p className="text-xs opacity-70">Not moving for 5+ minutes</p>
              </div>
            </div>
          ),
          { duration: 8000, style: { background: "#1a1a1a", color: "#fff", border: "1px solid #f59e0b66" } }
        );
      });

      socket.on("employee_tracking_started", (data) => {
        fetchLive();
        toast.success("📍 " + data.name + " started tracking");
      });

      socket.on("employee_tracking_stopped", () => fetchLive());

      socket.on("employee_offline", ({ employeeId }) => {
        const empIdStr = String(employeeId);
        setLocations(prev => { const n = { ...prev }; delete n[empIdStr]; delete n[employeeId]; return n; });
        setStationaryEmps(prev => { const n = new Set(prev); n.delete(empIdStr); return n; });
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
    setAddresses(prev => ({ ...prev, [String(empId)]: addr }));
  }, []);

  const fetchLive = async () => {
    setLoading(true);
    try {
      const { data } = await trackingAPI.getLive();
      setEmployees(data.employees || []);
      const locMap = {};
      (data.locations || []).forEach(l => {
        const empId = l.employee?._id || l.employee;
        if (empId) {
          const empIdStr = String(empId);
          const coords = l.coordinates && l.coordinates.length > 0
            ? l.coordinates
            : (l.lat && l.lng ? [{ lat: l.lat, lng: l.lng, address: l.address, timestamp: l.updatedAt || l.startTime }] : []);

          if (coords.length > 0) {
            const last = coords[coords.length - 1];
            const first = coords[0];
            const path = coords.map(c => ({ lat: c.lat, lng: c.lng, timestamp: c.timestamp, address: c.address }));
            locMap[empIdStr] = {
              ...last,
              isActive: l.isActive !== false,
              name: l.employee?.name || l.name,
              employeeIdCode: l.employee?.employeeId || l.employeeIdCode,
              avatar: l.employee?.avatar || l.avatar,
              department: l.employee?.department || l.department,
              totalDistance: l.totalDistance || 0,
              startTime: l.startTime || first.timestamp || new Date(),
              startAddress: l.startAddress || first.address,
              sessionId: l.sessionId,
              updatedAt: l.updatedAt || last.timestamp || new Date(),
              path
            };
            getEmpColor(empIdStr);
            if (last.address) setAddresses(prev => ({ ...prev, [empIdStr]: last.address }));
            else if (last.lat && last.lng) fetchAddress(empIdStr, last.lat, last.lng);
          }
        }
      });
      setLocations(locMap);

      // Auto-select first active tracking employee if none selected
      const allLocs = Object.entries(locMap);
      if (allLocs.length > 0) {
        const [firstEmpId, firstLoc] = allLocs[0];
        if (!selected) {
          setSelected(firstEmpId);
        }
        setFlyCenter([firstLoc.lat, firstLoc.lng]);
        setFlyZoom(14);
      }
    } catch {
      toast.error("Failed to load live data");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectEmployee = (empId) => {
    const empIdStr = String(empId);
    const newSelected = empIdStr === selected ? null : empIdStr;
    setSelected(newSelected);
    setSidebarOpen(false);

    if (newSelected) {
      const loc = locations[newSelected];
      if (loc && loc.lat && loc.lng) {
        setFlyCenter([loc.lat, loc.lng]);
        setFlyZoom(15);
      }
    }
  };

  const defaultCenter = [26.8467, 80.9462];

  // Resolve active selected employee and location details
  const selectedIdStr = selected ? String(selected) : null;
  const selectedLoc = selectedIdStr ? (locations[selectedIdStr] || locations[selected]) : null;
  const selectedEmp = selectedIdStr ? employees.find(e => String(e._id) === selectedIdStr) : null;
  const selectedColor = selectedIdStr ? getEmpColor(selectedIdStr) : "#3b82f6";
  const isSelectedStationary = selectedIdStr ? stationaryEmps.has(selectedIdStr) : false;

  return (
    <TrackProLayout>
      <div className="p-3 sm:p-4 lg:p-6 space-y-3 max-w-[1800px] mx-auto h-[calc(100vh-56px)] sm:h-[calc(100vh-80px)] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary-600/10 border border-primary-500/20 flex items-center justify-center text-primary-600">
              <MapPinned className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-[var(--text-main)] text-sm sm:text-base leading-none">Live Tracking Map</h1>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {trackingEmployees.length} Live
                </span>
              </div>
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Real-time GPS movement, travel distances & active field staff</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search staff, dept, code..."
                className="input-field pl-9 py-1.5 w-52 text-xs"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <button
              onClick={fetchLive}
              className="btn-secondary py-1.5 px-3 flex items-center gap-1.5 text-xs font-bold"
            >
              <RefreshCw className={"w-3.5 h-3.5 " + (loading ? "animate-spin" : "")} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex overflow-x-auto items-center gap-2 pb-1 hide-scrollbar flex-shrink-0">
          {[
            { id: "Active", label: "Tracking ON", count: stats.Active, color: "bg-emerald-600 border-emerald-500" },
            { id: "All", label: "All Staff", count: stats.All, color: "bg-primary-600 border-primary-500" },
            { id: "Away", label: "Away / Off", count: stats.Away, color: "bg-slate-600 border-slate-500" },
            { id: "Stationary", label: "⚠ Stationary", count: stats.Stationary, color: "bg-amber-600 border-amber-500" },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={"px-3.5 py-1.5 rounded-xl text-[10px] sm:text-xs font-black transition-all flex items-center gap-2 border whitespace-nowrap flex-shrink-0 " +
                (activeFilter === f.id
                  ? f.color + " text-white shadow-lg shadow-primary-500/10 scale-[1.02]"
                  : "bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border-color)] hover:border-primary-500/40 hover:text-[var(--text-main)]")
              }
            >
              <span className="uppercase tracking-wider">{f.label}</span>
              <span className={"px-1.5 py-0.5 rounded-md text-[10px] font-black " + (activeFilter === f.id ? "bg-white/20 text-white" : "bg-[var(--bg-main)] text-[var(--text-muted)]")}>
                {f.count}
              </span>
            </button>
          ))}
        </div>

        {/* Main Map + Directory View */}
        <div className="flex-1 flex flex-col lg:flex-row gap-3 min-h-0 overflow-hidden relative">

          {/* Leaflet Map Container */}
          <div className="flex-1 relative z-0 flex flex-col overflow-hidden rounded-2xl border border-[var(--border-color)] shadow-xl" style={{ minHeight: "420px" }}>
            <MapContainer
              center={flyCenter || defaultCenter}
              zoom={flyZoom || 12}
              style={{ height: "100%", minHeight: "420px", width: "100%" }}
              zoomControl={false}
            >
              <TileLayer
                attribution="&copy; Google Maps"
                url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                subdomains={["mt0", "mt1", "mt2", "mt3"]}
              />
              {flyCenter && <FlyTo center={flyCenter} zoom={flyZoom} />}

              {/* Markers for all active location pins */}
              {Object.entries(locations).map(([empId, loc]) => {
                const color = getEmpColor(empId);
                const empData = employees.find(e => String(e._id) === String(empId));
                const isStationary = stationaryEmps.has(String(empId));
                const isSelected = selectedIdStr === String(empId);

                return (
                  <Marker
                    key={empId}
                    position={[loc.lat, loc.lng]}
                    zIndexOffset={isSelected ? 2000 : isStationary ? 1000 : 0}
                    icon={createEmployeeIcon(loc.name || empData?.name, color, loc.isActive, loc.avatar || empData?.avatar, isStationary)}
                    eventHandlers={{ click: () => handleSelectEmployee(empId) }}
                  >
                    <Popup className="custom-popup">
                      <div className="p-3 min-w-[220px]">
                        <div className="flex items-center gap-2.5 mb-2">
                          {(loc.avatar || empData?.avatar) ? (
                            <img src={loc.avatar || empData?.avatar} className="w-9 h-9 rounded-xl object-cover border" style={{ borderColor: color }} alt={loc.name} />
                          ) : (
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-md" style={{ background: color }}>
                              {(loc.name || "?")[0].toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-black text-sm text-[var(--text-main)] truncate">{loc.name || empData?.name}</p>
                            <p className="text-[10px] text-[var(--text-muted)]">{loc.department || empData?.department || "Field Staff"}</p>
                          </div>
                        </div>

                        <div className="bg-[var(--bg-main)]/50 p-2 rounded-xl border border-[var(--border-color)] mb-2.5">
                          <p className="text-[10px] text-[var(--text-muted)] line-clamp-2 leading-relaxed flex items-start gap-1.5">
                            <MapPin className="w-3 h-3 text-primary-500 flex-shrink-0 mt-0.5" />
                            {addresses[empId] || loc.address || "Fetching current address..."}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mb-2.5">
                          <div className="bg-primary-500/10 p-2 rounded-xl text-center border border-primary-500/20">
                            <p className="text-[9px] font-black text-primary-600 uppercase">Speed</p>
                            <p className="text-xs font-black text-[var(--text-main)]">{Math.round((loc.speed || 0) * 3.6)} km/h</p>
                          </div>
                          <div className="bg-emerald-500/10 p-2 rounded-xl text-center border border-emerald-500/20">
                            <p className="text-[9px] font-black text-emerald-600 uppercase">Today Dist</p>
                            <p className="text-xs font-black text-[var(--text-main)]">{(loc.totalDistance || 0).toFixed(1)} km</p>
                          </div>
                        </div>

                        <button
                          onClick={() => window.location.href = "/admin/tracking-history?employee=" + empId}
                          className="w-full py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-md"
                        >
                          <History className="w-3 h-3" /> Full Route History
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}

              {/* Selected polyline path & start/end pin */}
              {selectedLoc && selectedLoc.path?.length > 1 && (
                <>
                  <Polyline
                    positions={selectedLoc.path.map(p => [p.lat, p.lng])}
                    pathOptions={{ color: selectedColor, weight: 14, opacity: 0.15, lineCap: "round" }}
                  />
                  <Polyline
                    positions={selectedLoc.path.map(p => [p.lat, p.lng])}
                    pathOptions={{ color: selectedColor, weight: 5, opacity: 0.95, lineCap: "round", lineJoin: "round" }}
                  />
                  <Polyline
                    positions={selectedLoc.path.map(p => [p.lat, p.lng])}
                    pathOptions={{ color: "#ffffff", weight: 1.5, opacity: 0.7, dashArray: "6, 12", lineCap: "round" }}
                  />
                  <Marker position={[selectedLoc.path[0].lat, selectedLoc.path[0].lng]} icon={createStartIcon()} />
                  <Marker
                    position={[selectedLoc.path[selectedLoc.path.length - 1].lat, selectedLoc.path[selectedLoc.path.length - 1].lng]}
                    icon={createCurrentIcon(selectedColor)}
                    zIndexOffset={3000}
                  />
                </>
              )}
            </MapContainer>

            {/* ========================================================================= */}
            {/* ⭐ LEFT-SIDE RICH TRAVEL & EMPLOYEE DETAILS CARD OVERLAY ⭐ */}
            {/* ========================================================================= */}
            {(selectedLoc || selectedEmp) && (
              <div className="absolute top-3 left-3 bottom-3 z-[500] w-[320px] sm:w-[360px] bg-[var(--bg-card)]/95 backdrop-blur-2xl rounded-2xl border border-[var(--border-color)] shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-left duration-300">
                
                {/* Panel Header */}
                <div className="p-3.5 border-b border-[var(--border-color)] bg-gradient-to-r from-[var(--bg-card)] to-[var(--bg-main)]/50 flex items-start justify-between gap-2 flex-shrink-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative flex-shrink-0">
                      {(selectedLoc?.avatar || selectedEmp?.avatar) ? (
                        <img
                          src={selectedLoc?.avatar || selectedEmp?.avatar}
                          alt={selectedEmp?.name || selectedLoc?.name}
                          className="w-12 h-12 rounded-2xl object-cover border-2 shadow-md"
                          style={{ borderColor: selectedColor }}
                        />
                      ) : (
                        <div
                          className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-base shadow-md"
                          style={{ background: selectedColor }}
                        >
                          {((selectedEmp?.name || selectedLoc?.name || "?")[0]).toUpperCase()}
                        </div>
                      )}
                      <div className={"absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[var(--bg-card)] " +
                        (selectedLoc?.isActive || selectedEmp?.isTracking ? "bg-emerald-500 animate-pulse" : "bg-slate-400")}
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h2 className="text-sm font-black text-[var(--text-main)] truncate">
                          {selectedEmp?.name || selectedLoc?.name || "Staff Details"}
                        </h2>
                      </div>
                      <p className="text-[11px] font-bold text-[var(--text-muted)] truncate">
                        {selectedEmp?.designation || selectedLoc?.department || selectedEmp?.department || "Field Staff"}
                      </p>
                      {selectedEmp?.employeeId && (
                        <span className="inline-block text-[9px] font-bold text-primary-600 bg-primary-500/10 px-1.5 py-0.2 rounded border border-primary-500/20 mt-0.5">
                          {selectedEmp.employeeId}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => setSelected(null)}
                    className="p-1.5 hover:bg-[var(--bg-main)] text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-xl transition-colors flex-shrink-0 border border-transparent hover:border-[var(--border-color)]"
                    title="Close Panel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Scrollable Metrics & Travel Info */}
                <div className="flex-1 overflow-y-auto p-3.5 space-y-3 custom-scrollbar">

                  {/* Status Banner */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)]">
                    <div className="flex items-center gap-2">
                      <div className={"w-2.5 h-2.5 rounded-full " + (selectedLoc?.isActive || selectedEmp?.isTracking ? "bg-emerald-500 animate-ping" : "bg-slate-400")} />
                      <span className="text-xs font-black text-[var(--text-main)]">
                        {selectedLoc?.isActive || selectedEmp?.isTracking ? "Live Tracking Active" : "Offline / Not Tracking"}
                      </span>
                    </div>
                    {isSelectedStationary && (
                      <span className="text-[10px] font-black text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Still 5m+
                      </span>
                    )}
                  </div>

                  {/* Travel Stats Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-emerald-600 mb-1">
                        <Route className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-black uppercase tracking-wider">Distance</span>
                      </div>
                      <p className="text-lg font-black text-[var(--text-main)] leading-none">
                        {(selectedLoc?.totalDistance || 0).toFixed(2)}
                      </p>
                      <p className="text-[9px] font-bold text-emerald-600 mt-0.5">kilometers today</p>
                    </div>

                    <div className="bg-primary-500/10 border border-primary-500/20 rounded-2xl p-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-primary-600 mb-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-black uppercase tracking-wider">Duration</span>
                      </div>
                      <p className="text-lg font-black text-[var(--text-main)] leading-none">
                        {selectedLoc?.startTime ? formatTravelDuration(selectedLoc.startTime) : "0m"}
                      </p>
                      <p className="text-[9px] font-bold text-primary-600 mt-0.5">travel time</p>
                    </div>

                    <div className="bg-violet-500/10 border border-violet-500/20 rounded-2xl p-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-violet-600 mb-1">
                        <Gauge className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-black uppercase tracking-wider">Current Speed</span>
                      </div>
                      <p className="text-lg font-black text-[var(--text-main)] leading-none">
                        {Math.round((selectedLoc?.speed || 0) * 3.6)} <span className="text-xs">km/h</span>
                      </p>
                      <p className="text-[9px] font-bold text-violet-600 mt-0.5">GPS telemetry</p>
                    </div>

                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-amber-600 mb-1">
                        <MapPin className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-black uppercase tracking-wider">Waypoints</span>
                      </div>
                      <p className="text-lg font-black text-[var(--text-main)] leading-none">
                        {selectedLoc?.path?.length || 1}
                      </p>
                      <p className="text-[9px] font-bold text-amber-600 mt-0.5">recorded points</p>
                    </div>
                  </div>

                  {/* Route Addresses */}
                  <div className="bg-[var(--bg-main)]/70 rounded-2xl p-3 border border-[var(--border-color)] space-y-2.5">
                    <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                      <Navigation className="w-3.5 h-3.5 text-primary-500" /> Live Movement Path
                    </p>

                    {/* Current Address */}
                    <div className="flex items-start gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 flex-shrink-0 mt-0.5">
                        <MapPin className="w-3 h-3" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-black text-[var(--text-muted)] uppercase">Current Location</p>
                        <p className="text-xs font-bold text-[var(--text-main)] leading-relaxed">
                          {addresses[selectedIdStr] || selectedLoc?.address || "Detecting live GPS coordinates..."}
                        </p>
                      </div>
                    </div>

                    {/* Start Address */}
                    <div className="flex items-start gap-2.5 border-t border-[var(--border-color)] pt-2">
                      <div className="w-6 h-6 rounded-full bg-primary-500/10 border border-primary-500/30 flex items-center justify-center text-primary-600 font-black text-[10px] flex-shrink-0 mt-0.5">
                        S
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-black text-[var(--text-muted)] uppercase">Started At</p>
                        <p className="text-xs font-bold text-[var(--text-main)] leading-relaxed">
                          {selectedLoc?.startAddress || selectedLoc?.path?.[0]?.address || "Starting point recorded at session begin"}
                        </p>
                        {selectedLoc?.startTime && (
                          <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                            {new Date(selectedLoc.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Staff Contact Info */}
                  {(selectedEmp?.phone || selectedEmp?.email) && (
                    <div className="bg-[var(--bg-main)]/50 rounded-2xl p-2.5 border border-[var(--border-color)] space-y-1.5">
                      <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider">Contact Staff</p>
                      <div className="flex items-center gap-2">
                        {selectedEmp?.phone && (
                          <a
                            href={"tel:" + selectedEmp.phone}
                            className="flex-1 py-1.5 px-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 text-[11px] font-black flex items-center justify-center gap-1.5 border border-emerald-500/20 transition-all"
                          >
                            <Phone className="w-3 h-3" /> {selectedEmp.phone}
                          </a>
                        )}
                        {selectedEmp?.email && (
                          <a
                            href={"mailto:" + selectedEmp.email}
                            className="p-1.5 rounded-xl bg-primary-500/10 hover:bg-primary-500/20 text-primary-600 text-[11px] font-bold flex items-center justify-center border border-primary-500/20 transition-all"
                            title={selectedEmp.email}
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                </div>

                {/* Panel Footer Actions */}
                <div className="p-3 border-t border-[var(--border-color)] bg-[var(--bg-card)] flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => {
                      if (selectedLoc?.lat && selectedLoc?.lng) {
                        setFlyCenter([selectedLoc.lat, selectedLoc.lng]);
                        setFlyZoom(16);
                      }
                    }}
                    className="flex-1 py-2 rounded-xl bg-[var(--bg-main)] hover:bg-[var(--bg-card-hover)] text-[var(--text-main)] text-xs font-black uppercase tracking-wider transition-all border border-[var(--border-color)] flex items-center justify-center gap-1.5"
                  >
                    <MapPin className="w-3.5 h-3.5 text-primary-500" /> Center
                  </button>

                  <button
                    onClick={() => window.location.href = "/admin/tracking-history?employee=" + (selectedIdStr || selectedEmp?._id)}
                    className="flex-1 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-1.5"
                  >
                    <History className="w-3.5 h-3.5" /> Route History
                  </button>
                </div>

              </div>
            )}

            {/* Map Legend */}
            <div className="absolute bottom-4 left-3 z-[400] bg-[var(--bg-card)]/90 backdrop-blur-md rounded-xl border border-[var(--border-color)] shadow-xl p-2.5 space-y-1">
              <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">Legend</p>
              {[
                { color: "bg-emerald-500", label: "Active Tracking" },
                { color: "bg-slate-400", label: "Away / Off" },
                { color: "bg-amber-500", label: "Stationary" },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <div className={"w-2.5 h-2.5 rounded-full " + item.color} />
                  <span className="text-[9px] text-[var(--text-main)] font-bold">{item.label}</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[7px] font-bold">S</div>
                <span className="text-[9px] text-[var(--text-main)] font-bold">Start Point</span>
              </div>
            </div>

            {/* Mobile Toggle Button */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden absolute bottom-4 right-3 z-[500] flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white px-4 py-2.5 rounded-2xl shadow-xl text-xs font-black uppercase tracking-widest transition-all"
            >
              <Users className="w-4 h-4" />
              Staff ({filteredEmployees.length})
              {sidebarOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
            </button>
          </div>

          {/* ========================================================================= */}
          {/* RIGHT-SIDE TEAM DIRECTORY */}
          {/* ========================================================================= */}
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
            <div className="p-3 border-b border-[var(--border-color)] bg-[var(--bg-card)] flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-[var(--text-main)] font-black text-xs uppercase tracking-widest flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-primary-500" /> Team Directory
                </h3>
                <p className="text-[10px] text-[var(--text-muted)] font-bold">
                  {filteredEmployees.length} staff {activeFilter === "Active" ? "tracking on" : "listed"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {selected && (
                  <button
                    onClick={() => setSelected(null)}
                    className="text-[10px] font-bold text-primary-500 hover:underline"
                  >
                    Clear Selected
                  </button>
                )}
                <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 hover:bg-white/10 rounded-lg">
                  <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
                </button>
              </div>
            </div>

            {/* List of Staff */}
            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar space-y-1">
              {loading ? (
                [1, 2, 3, 4].map(i => <div key={i} className="h-16 rounded-xl bg-[var(--bg-card)] animate-pulse m-1" />)
              ) : filteredEmployees.length === 0 ? (
                <div className="p-6 text-center flex flex-col items-center justify-center my-auto space-y-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 shadow-xs">
                    <MapPinned className="w-5 h-5 animate-pulse" />
                  </div>
                  <p className="text-[var(--text-main)] font-black text-xs">No Staff Tracking Currently</p>
                  <p className="text-[10px] text-[var(--text-muted)] max-w-[200px] leading-relaxed">
                    Employees will automatically appear on this live map as soon as they start tracking from their mobile app.
                  </p>
                  <button
                    onClick={() => setActiveFilter("All")}
                    className="mt-2 text-xs font-black text-primary-600 hover:underline"
                  >
                    View All Staff ({stats.All})
                  </button>
                </div>
              ) : (
                filteredEmployees.map((emp) => {
                  const empIdStr = String(emp._id);
                  const loc = locations[empIdStr] || locations[emp._id];
                  const color = getEmpColor(empIdStr);
                  const isSelected = selectedIdStr === empIdStr;
                  const isStationary = stationaryEmps.has(empIdStr);
                  const isActiveTracking = loc?.isActive || emp.isTracking;

                  return (
                    <div
                      key={emp._id}
                      onClick={() => handleSelectEmployee(emp._id)}
                      className={"group flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all border " +
                        (isSelected
                          ? "border-primary-500/50 bg-primary-600/10 shadow-md shadow-primary-500/10"
                          : "border-transparent hover:bg-[var(--bg-card-hover)] hover:border-[var(--border-color)]")
                      }
                    >
                      {/* Avatar */}
                      <div className="relative flex-shrink-0">
                        {emp.avatar ? (
                          <img
                            src={emp.avatar}
                            alt={emp.name}
                            className="w-10 h-10 rounded-xl object-cover"
                            style={{ border: "2px solid " + color }}
                          />
                        ) : (
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-md"
                            style={{ background: color }}
                          >
                            {emp.name ? emp.name[0].toUpperCase() : "E"}
                          </div>
                        )}
                        {isActiveTracking && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[var(--bg-sidebar)]" />
                        )}
                        {isStationary && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 border-2 border-[var(--bg-sidebar)] flex items-center justify-center text-[9px] text-white font-black">
                            !
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <p className="text-[var(--text-main)] font-black text-xs truncate">{emp.name}</p>
                          {loc && (
                            <span className="text-emerald-600 text-[10px] font-black italic flex-shrink-0 ml-1">
                              {(loc.totalDistance || 0).toFixed(1)} km
                            </span>
                          )}
                        </div>
                        <p className="text-[var(--text-muted)] text-[10px] font-medium truncate">
                          {loc
                            ? (addresses[empIdStr]?.split(",")[0] || addresses[emp._id]?.split(",")[0] || "Locating...")
                            : (emp.department || "Field Services")}
                        </p>
                        {isStationary && <span className="text-[8px] font-black text-amber-500">⚠ Stationary 5+ min</span>}
                      </div>

                      {loc?.startTime && (
                        <span className="text-[var(--text-muted)] text-[9px] font-bold flex-shrink-0 bg-[var(--bg-main)] px-1.5 py-0.5 rounded border border-[var(--border-color)]">
                          {formatTravelDuration(loc.startTime)}
                        </span>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.location.href = "/admin/tracking-history?employee=" + emp._id;
                        }}
                        className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 bg-[var(--bg-main)] text-[var(--text-muted)] hover:text-primary-500 hover:bg-primary-500/10 transition-all flex-shrink-0"
                        title="View Route History"
                      >
                        <History className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </TrackProLayout>
  );
}