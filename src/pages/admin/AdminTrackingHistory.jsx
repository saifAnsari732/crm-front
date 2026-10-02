import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import KisanConnectLayout from '../../components/layout/KisanConnectLayout';
import { adminAPI, trackingAPI } from '../../services/api.service';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import {
  Calendar,
  MapPin,
  Navigation,
  Clock,
  ChevronRight,
  Search,
  Download,
  Loader2,
  FileImage,
  Activity,
  Gauge,
  Route,
  Zap,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  SlidersHorizontal,
  RefreshCw,
  LogOut,
  LogIn,
  Battery,
  ShieldCheck,
  Plus,
  X,
  Edit3,
  User,
  Sparkles,
  Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import L from 'leaflet';
import html2canvas from 'html2canvas';

// Custom Marker Icons
const startIcon = L.divIcon({
  className: 'custom-start-marker',
  html: `<div style="width:28px;height:28px;border-radius:10px;background:#22c55e;border:3px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:10px;transform:rotate(45deg);"><div style="transform:rotate(-45deg)">IN</div></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const endIcon = L.divIcon({
  className: 'custom-end-marker',
  html: `<div style="width:28px;height:28px;border-radius:10px;background:#ef4444;border:3px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:10px;transform:rotate(45deg);"><div style="transform:rotate(-45deg)">OUT</div></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const stopIcon = L.divIcon({
  className: 'custom-stop-marker',
  html: `<div style="width:24px;height:24px;border-radius:50%;background:#f59e0b;border:3px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:10px;">P</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

// Pulse Animation Style
const pulseStyle = document.createElement('style');
pulseStyle.textContent = `
  @keyframes trkPulse {
    0% { transform: scale(0.7); opacity: 0.8; }
    70% { transform: scale(2.5); opacity: 0; }
    100% { transform: scale(0.7); opacity: 0; }
  }
  .pulse-ring {
    position: absolute;
    top: -10px;
    left: -10px;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: #3b82f633;
    animation: trkPulse 2s infinite;
  }
  @keyframes innerPulse {
    0% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.4); opacity: 0.7; }
    100% { transform: scale(1); opacity: 1; }
  }
  .inner-pulse {
    animation: innerPulse 1.5s ease-in-out infinite;
  }
`;
if (!document.getElementById('trk-pulse-style')) {
  pulseStyle.id = 'trk-pulse-style';
  document.head.appendChild(pulseStyle);
}

// Multi-Marker re-center helper (fits all employees on initial load)
function MultiMapBounds({ sessions }) {
  const map = useMap();
  useEffect(() => {
    const validCoords = sessions
      .map((s) => s.coordinates?.[s.coordinates?.length - 1] || s.coordinates?.[0])
      .filter((c) => c && c.lat && c.lng);
    if (validCoords.length > 0) {
      const bounds = L.latLngBounds(validCoords.map((c) => [c.lat, c.lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [sessions, map]);
  return null;
}

// Individual Path & Marker re-center helper
function MapBounds({ coords, trigger }) {
  const map = useMap();
  useEffect(() => {
    if (!coords || coords.length === 0) return;
    if (coords.length === 1 && coords[0]?.lat && coords[0]?.lng) {
      map.flyTo([coords[0].lat, coords[0].lng], 16, { duration: 1.0 });
    } else if (coords.length > 1) {
      const validCoords = coords.filter((c) => c && c.lat && c.lng);
      if (validCoords.length > 0) {
        const bounds = L.latLngBounds(validCoords.map((c) => [c.lat, c.lng]));
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      }
    }
  }, [coords, map, trigger]);
  return null;
}

// Custom FlyTo helper
function FlyTo({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.flyTo(center, zoom || 15, { duration: 1.0 });
    }
  }, [center, zoom, map]);
  return null;
}

const processTimeline = (session) => {
  if (!session || !session.coordinates || session.coordinates.length === 0) return [];

  const coords = session.coordinates;
  const events = [];

  // 1. Punch In
  events.push({
    type: 'Punch In',
    time: session.startTime,
    address: session.startAddress,
    lat: coords[0].lat,
    lng: coords[0].lng,
    icon: 'target',
  });

  let lastEventCoord = coords[0];
  let currentSegment = [];

  for (let i = 1; i < coords.length; i++) {
    const c = coords[i];
    const prev = coords[i - 1];

    const timeDiff = (new Date(c.timestamp) - new Date(prev.timestamp)) / (1000 * 60); // minutes

    // Stop detection: Only register a stop if the time gap is significant (15+ mins)
    if (timeDiff > 15) {
      if (currentSegment.length > 0) {
        const dist = currentSegment.reduce((acc, curr, idx) => {
          if (idx === 0) return 0;
          const p = currentSegment[idx - 1];
          const d = L.latLng(p.lat, p.lng).distanceTo(L.latLng(curr.lat, curr.lng)) / 1000;
          return acc + d;
        }, 0);

        events.push({
          type: 'Drive',
          duration: Math.round((new Date(prev.timestamp) - new Date(lastEventCoord.timestamp)) / (1000 * 60)),
          distance: dist.toFixed(2),
          icon: 'navigation',
        });
      }

      events.push({
        type: 'Stop',
        time: c.timestamp,
        duration: Math.round(timeDiff),
        address: c.address,
        lat: c.lat,
        lng: c.lng,
        icon: 'map-pin',
      });

      lastEventCoord = c;
      currentSegment = [];
    } else {
      currentSegment.push(c);
    }
  }

  // Final Segment
  if (currentSegment.length > 0) {
    const last = currentSegment[currentSegment.length - 1];
    const dist = currentSegment.reduce((acc, curr, idx) => {
      if (idx === 0) return 0;
      const p = currentSegment[idx - 1];
      const d = L.latLng(p.lat, p.lng).distanceTo(L.latLng(curr.lat, curr.lng)) / 1000;
      return acc + d;
    }, 0);

    events.push({
      type: 'Travel',
      duration: Math.round((new Date(last.timestamp) - new Date(lastEventCoord.timestamp)) / (1000 * 60)),
      distance: dist.toFixed(2),
      icon: 'navigation',
    });
  }

  // 2. Punch Out / Last Known
  const finalCoord = coords[coords.length - 1];

  if (session.isActive) {
    events.push({
      type: 'Last Known Location',
      time: finalCoord.timestamp,
      address: finalCoord.address,
      lat: finalCoord.lat,
      lng: finalCoord.lng,
      icon: 'activity',
    });
    events.push({
      type: 'Punch Out',
      time: null,
      address: 'Currently Tracking (Pending Check-Out)',
      lat: finalCoord.lat,
      lng: finalCoord.lng,
      icon: 'power',
      isPending: true,
    });
  } else {
    events.push({
      type: 'Punch Out',
      time: session.endTime || finalCoord.timestamp,
      address: session.endAddress || finalCoord.address,
      lat: finalCoord.lat,
      lng: finalCoord.lng,
      icon: 'power',
    });
  }

  return events;
};

export default function AdminTrackingHistory() {
  const todayStr = new Date().toISOString().slice(0, 10);

  // Date Filter Modes: 'today' | 'yesterday' | 'last7' | 'range'
  const [filterMode, setFilterMode] = useState('today');
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [selectionTrigger, setSelectionTrigger] = useState(0);
  const [flyCenter, setFlyCenter] = useState(null);
  const [flyZoom, setFlyZoom] = useState(14);
  const reportRef = useRef(null);

  // Fetch employees on mount
  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const { data } = await adminAPI.getEmployees({ limit: 300, role: 'all' });
      setEmployees(data.employees || []);
    } catch {
      toast.error('Failed to load employees');
    }
  };

  // Set Preset Dates
  const handlePresetSelect = (preset) => {
    setFilterMode(preset);
    const now = new Date();

    if (preset === 'today') {
      const d = now.toISOString().slice(0, 10);
      setStartDate(d);
      setEndDate(d);
    } else if (preset === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const d = y.toISOString().slice(0, 10);
      setStartDate(d);
      setEndDate(d);
    } else if (preset === 'last7') {
      const s = new Date(now);
      s.setDate(s.getDate() - 6);
      setStartDate(s.toISOString().slice(0, 10));
      setEndDate(now.toISOString().slice(0, 10));
    }
  };

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        employeeId: selectedEmployeeId || undefined,
      };

      if (startDate === endDate) {
        params.date = startDate;
      } else {
        params.startDate = startDate;
        params.endDate = endDate;
      }

      const { data } = await adminAPI.getHistory(params);
      const sessions = data.history || [];
      setHistory(sessions);

      if (sessions.length > 0) {
        handleSelectSession(sessions[0]);
      } else {
        setSelectedSession(null);
      }
    } catch {
      toast.error('Failed to load KM tracking history');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedEmployeeId]);

  // Fetch history when dates or employee change
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleSelectSession = async (session) => {
    if (!session) return;
    setSelectionTrigger((prev) => prev + 1);

    // Immediately set selected session so card highlights instantly
    setSelectedSession(session);

    // If session already has coordinate(s), fly to them immediately
    if (session.coordinates && session.coordinates.length > 0) {
      const targetCoord = session.coordinates[session.coordinates.length - 1] || session.coordinates[0];
      if (targetCoord?.lat && targetCoord?.lng) {
        setFlyCenter([targetCoord.lat, targetCoord.lng]);
        setFlyZoom(session.coordinates.length > 1 ? 15 : 16);
      }
    }

    setSessionLoading(true);
    try {
      const { data } = await trackingAPI.getSession(session._id);
      if (data.success && data.session) {
        const fullSession = { ...session, ...data.session };
        setSelectedSession(fullSession);
        
        const coords = fullSession.coordinates || [];
        if (coords.length > 0) {
          const latestCoord = coords[coords.length - 1] || coords[0];
          if (latestCoord?.lat && latestCoord?.lng) {
            setFlyCenter([latestCoord.lat, latestCoord.lng]);
            setFlyZoom(coords.length > 1 ? 15 : 16);
            setSelectionTrigger((prev) => prev + 1);
          }
        }
      }
    } catch {
      // Fallback already set
    } finally {
      setSessionLoading(false);
    }
  };

  // Summary Metrics calculation
  const totalKmSum = useMemo(() => {
    return history.reduce((sum, s) => sum + (Number(s.totalDistance) || 0), 0);
  }, [history]);

  const activeSessionsCount = useMemo(() => {
    return history.filter((s) => s.isActive).length;
  }, [history]);

  const completedSessionsCount = useMemo(() => {
    return history.filter((s) => !s.isActive).length;
  }, [history]);

  const mapCenter =
    selectedSession?.coordinates?.length > 0
      ? [selectedSession.coordinates[0].lat, selectedSession.coordinates[0].lng]
      : [26.8467, 80.9462];

  // Export to CSV
  const exportToCSV = () => {
    if (!selectedSession || !selectedSession.coordinates) return;

    const employee = selectedSession.employee || {};
    const reportDate = new Date(selectedSession.date).toLocaleDateString('en-IN');

    let csvContent = 'data:text/csv;charset=utf-8,';

    csvContent += `FIELD CRM - KM TRACKING & CHECKOUT REPORT\n`;
    csvContent += `------------------------------------\n`;
    csvContent += `Employee Name,${employee.name || 'N/A'}\n`;
    csvContent += `Employee ID,${employee.employeeId || 'N/A'}\n`;
    csvContent += `Department,${employee.department || 'N/A'}\n`;
    csvContent += `Session Date,${reportDate}\n`;
    csvContent += `Total Distance Traveled,${(selectedSession.totalDistance || 0).toFixed(2)} km\n`;
    csvContent += `Check-In Start Location,"${(selectedSession.startAddress || 'N/A').replace(/"/g, '""')}"\n`;
    csvContent += `Check-Out End Location,"${(selectedSession.endAddress || 'N/A').replace(/"/g, '""')}"\n`;
    csvContent += `Check-In Time,${new Date(selectedSession.startTime).toLocaleTimeString()}\n`;
    csvContent += `Check-Out Time,${selectedSession.endTime ? new Date(selectedSession.endTime).toLocaleTimeString() : 'Live Tracking'}\n`;
    csvContent += `Status,${selectedSession.isActive ? 'Active (In-Progress)' : 'Checked-Out'}\n\n`;

    csvContent += 'S.No,Timestamp,Latitude,Longitude,Speed (km/h),Accuracy (m),Address\n';

    selectedSession.coordinates.slice().reverse().forEach((c, i) => {
      const time = new Date(c.timestamp).toLocaleTimeString();
      const addr = `"${(c.address || 'N/A').replace(/"/g, '""')}"`;
      const speed = (c.speed * 3.6).toFixed(1);
      const acc = c.accuracy || 'N/A';
      csvContent += `${i + 1},${time},${c.lat},${c.lng},${speed},${acc},${addr}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `KM_Report_${employee.name}_${reportDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('KM Report exported as CSV! 📊');
  };

  // Adjust Distance Modal State
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustTargetSession, setAdjustTargetSession] = useState(null);
  const [adjustEmployeeId, setAdjustEmployeeId] = useState('');
  const [adjustDate, setAdjustDate] = useState(todayStr);
  const [adjustMode, setAdjustMode] = useState('add'); // 'add' | 'set'
  const [adjustKmValue, setAdjustKmValue] = useState('5');
  const [adjustReason, setAdjustReason] = useState('Official field commute allowance');
  const [adjustLoading, setAdjustLoading] = useState(false);

  const openAdjustModal = (session = null) => {
    if (session) {
      setAdjustTargetSession(session);
      setAdjustEmployeeId(session.employee?._id || session.employee || '');
      setAdjustDate(session.date || (session.startTime ? session.startTime.slice(0, 10) : todayStr));
    } else {
      setAdjustTargetSession(null);
      setAdjustEmployeeId(selectedEmployeeId || (employees.length > 0 ? employees[0]._id : ''));
      setAdjustDate(startDate || todayStr);
    }
    setAdjustMode('add');
    setAdjustKmValue('5');
    setAdjustReason('Official field commute allowance');
    setIsAdjustModalOpen(true);
  };

  const handleApplyAdjustment = async (e) => {
    if (e) e.preventDefault();
    const km = parseFloat(adjustKmValue);
    if (isNaN(km) || km < 0) {
      toast.error('Please enter a valid KM number (0 or greater)');
      return;
    }

    if (!adjustEmployeeId && !adjustTargetSession) {
      toast.error('Please select an employee');
      return;
    }

    setAdjustLoading(true);
    try {
      const payload = {
        sessionId: adjustTargetSession?._id,
        employeeId: adjustEmployeeId,
        date: adjustDate,
        distanceToAdd: km,
        newTotalDistance: km,
        mode: adjustMode,
        reason: adjustReason,
      };

      const { data } = await adminAPI.adjustDistance(payload);
      if (data.success) {
        toast.success(data.message || `Successfully adjusted distance!`, { id: 'adjust-distance' });
        setIsAdjustModalOpen(false);
        fetchHistory();
        if (data.session) {
          setSelectedSession((prev) => {
            if (prev && prev._id === data.session._id) {
              return { ...prev, ...data.session };
            }
            return data.session;
          });
        }
      } else {
        toast.error(data.message || 'Failed to adjust distance');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to adjust distance');
    } finally {
      setAdjustLoading(false);
    }
  };

  // Export Map Image Snapshot
  const exportImage = async () => {
    if (!reportRef.current) return;
    try {
      toast.loading('Generating KM snapshot report...', { id: 'export-image' });
      const canvas = await html2canvas(reportRef.current, {
        useCORS: true,
        scale: 2,
        logging: false,
      });
      const imgData = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = imgData;
      link.download = `KM_Session_${selectedSession?.employee?.name || 'Report'}_${new Date().toISOString().slice(0, 10)}.png`;
      link.click();
      toast.success('KM Image snapshot saved!', { id: 'export-image' });
    } catch (err) {
      toast.error('Failed to generate image report', { id: 'export-image' });
    }
  };

  return (
    <KisanConnectLayout>
      <div className="p-4 lg:p-6 space-y-6 max-w-[1650px] mx-auto pb-12">
        {/* Top Header & Presets Bar */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider bg-rose-50 text-rose-600 border border-rose-200 rounded-lg flex items-center gap-1.5">
                <Route className="w-3.5 h-3.5" /> Mileage & Route Telemetry
              </span>
              <span className="text-xs text-slate-500 font-semibold">GPS Verified History</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1 flex items-center gap-2">
              <Gauge className="w-6 h-6 text-rose-600" />
              KM History & Check-Out Audit
            </h1>
            <p className="text-slate-500 text-xs font-semibold mt-0.5">
              Review daily travel distance, start-to-end GPS displacement, check-in & check-out logs.
            </p>
          </div>

          {/* Quick Date Range Buttons & Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Presets: Today | Yesterday | Last 7 Days | Custom Range */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                onClick={() => handlePresetSelect('today')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  filterMode === 'today'
                    ? 'bg-white text-rose-600 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Today
              </button>

              <button
                onClick={() => handlePresetSelect('yesterday')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  filterMode === 'yesterday'
                    ? 'bg-white text-rose-600 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Yesterday
              </button>

              <button
                onClick={() => handlePresetSelect('last7')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  filterMode === 'last7'
                    ? 'bg-white text-rose-600 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Last 7 Days
              </button>

              <button
                onClick={() => setFilterMode('range')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  filterMode === 'range'
                    ? 'bg-white text-rose-600 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Date Range
              </button>
            </div>

            {/* Date Pickers */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-xs">
              <Calendar className="w-4 h-4 text-rose-500 flex-shrink-0" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setFilterMode('range');
                }}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none"
              />
              <span className="text-slate-400 text-xs font-bold">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setFilterMode('range');
                }}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none"
              />
            </div>

            {/* Employee Filter */}
            <div className="relative">
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 font-bold text-slate-800"
              >
                <option value="">All Field Employees ({employees.length})</option>
                {employees.map((e) => (
                  <option key={e._id} value={e._id}>
                    {e.name} ({e.employeeId || 'EMP'})
                  </option>
                ))}
              </select>
            </div>

            {/* Action Buttons: Adjust KM, Export Snapshot, Refresh */}
            <button
              onClick={() => openAdjustModal(selectedSession || null)}
              className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-emerald-600 via-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl shadow-xs text-xs font-black transition active:scale-95 cursor-pointer"
              title="Give or adjust KM for an employee"
            >
              <Plus className="w-4 h-4" />
              <span>Adjust / Give KM</span>
            </button>

            <button
              onClick={exportImage}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
              title="Download Map Snapshot"
            >
              <FileImage className="w-4 h-4" />
            </button>

            {selectedSession && (
              <button
                onClick={exportToCSV}
                className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
                title="Export Shift CSV Report"
              >
                <Download className="w-4 h-4" />
              </button>
            )}

            {/* Refresh Button */}
            <button
              onClick={fetchHistory}
              className="p-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
              title="Refresh KM History"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* 4 KPI Metric Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-rose-500 to-rose-700 text-white p-5 rounded-2xl shadow-sm flex flex-col justify-between">
            <div>
              <span className="text-xs font-black text-rose-100 uppercase tracking-wider">Total KM Traveled</span>
              <h3 className="text-3xl font-black mt-1">
                {totalKmSum.toFixed(1)} <span className="text-base font-bold text-rose-200">KM</span>
              </h3>
            </div>
            <span className="text-[11px] font-semibold text-rose-100 mt-2 block">
              Across {history.length} logged sessions
            </span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Logged Sessions</span>
              <h3 className="text-3xl font-black text-slate-900 mt-1">{history.length}</h3>
            </div>
            <span className="text-xs font-bold text-slate-600 mt-2 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-blue-500" />
              {startDate === endDate ? `Date: ${startDate}` : `${startDate} → ${endDate}`}
            </span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Completed Check-Outs</span>
              <h3 className="text-3xl font-black text-emerald-600 mt-1">{completedSessionsCount}</h3>
            </div>
            <span className="text-xs font-bold text-emerald-600 mt-2 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Finished shifts with start & end KM
            </span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active / In-Progress</span>
              <h3 className="text-3xl font-black text-amber-600 mt-1">{activeSessionsCount}</h3>
            </div>
            <span className="text-xs font-bold text-amber-600 mt-2 flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-amber-500 animate-pulse" /> Currently tracking in field
            </span>
          </div>
        </div>

        {/* Main Workspace: Session List (Left) + Detailed Map & Checkout Audit (Right) */}
        <div ref={reportRef} className="flex flex-col xl:flex-row gap-6 items-start">
          {/* 1. Left Session Explorer */}
          <div className="w-full xl:w-[400px] flex flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden h-[620px] xl:h-[660px] shrink-0 shadow-sm">
            <div className="p-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-slate-900 font-black text-xs uppercase tracking-wider flex items-center gap-2">
                  <Clock className="w-4 h-4 text-rose-500" /> KM Sessions Ledger
                </h3>
                <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                  {history.length} {history.length === 1 ? 'record' : 'records'} found
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
              {loading ? (
                [1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse border border-slate-200" />
                ))
              ) : history.length === 0 ? (
                <div className="p-8 text-center flex flex-col items-center justify-center my-auto h-full text-slate-400">
                  <Route className="w-10 h-10 opacity-30 mb-2" />
                  <p className="font-bold text-xs text-slate-700">No KM Sessions Found</p>
                  <p className="text-[11px] mt-1">Try choosing a different date range or selecting "Today".</p>
                </div>
              ) : (
                history.map((session) => {
                  const isSelected = selectedSession?._id === session._id;
                  const dist = (Number(session.totalDistance) || 0).toFixed(1);
                  return (
                    <div
                      key={session._id}
                      onClick={() => handleSelectSession(session)}
                      className={`group relative rounded-xl p-3.5 cursor-pointer transition-all duration-200 border-2 ${
                        isSelected
                          ? 'bg-rose-50/80 border-rose-500 shadow-sm'
                          : 'bg-white border-slate-200 hover:border-rose-300 hover:bg-slate-50/60'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm uppercase flex-shrink-0 overflow-hidden ${
                            isSelected ? 'bg-rose-500 text-white shadow-xs' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {session.employee?.avatar ? (
                            <img
                              src={session.employee.avatar}
                              alt={session.employee.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            session.employee?.name?.[0] || 'E'
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <h4
                              className={`font-black text-sm tracking-tight truncate ${
                                isSelected ? 'text-rose-700' : 'text-slate-900 group-hover:text-rose-600'
                              }`}
                            >
                              {session.employee?.name || 'Field Employee'}
                            </h4>
                            <span className="text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex-shrink-0">
                              {dist} KM
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-semibold mt-1">
                            <span>{session.date || session.createdAt?.slice(0, 10)}</span>
                            <span>•</span>
                            <span>
                              {new Date(session.startTime).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                              {' → '}
                              {session.isActive
                                ? 'LIVE'
                                : new Date(session.endTime || session.updatedAt).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                            </span>
                          </div>

                          {/* Check-In / Check-Out Badges & Quick Action */}
                          <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  session.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                                }`}
                              />
                              <span className="text-[10px] font-bold text-slate-600">
                                {session.isActive ? 'Active Shift' : 'Checked-Out'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openAdjustModal(session);
                                }}
                                className="px-2 py-0.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-extrabold flex items-center gap-1 transition cursor-pointer active:scale-95"
                                title="Adjust or give extra KM to this shift"
                              >
                                <Plus className="w-2.5 h-2.5 text-emerald-600" />
                                <span>Adjust KM</span>
                              </button>
                              <span className="text-[10px] font-bold text-rose-600 group-hover:underline flex items-center gap-0.5">
                                <Navigation className="w-3 h-3" /> Map
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 2. Center & Right Workspace: Map & Check-Out Inspection Card */}
          <div className="flex-1 flex flex-col gap-4 min-w-0 w-full">
            {/* Leaflet Interactive Route Map */}
            <div className="h-[360px] sm:h-[400px] w-full bg-white rounded-2xl border border-slate-200 overflow-hidden relative shadow-sm">
              {sessionLoading && (
                <div className="absolute inset-0 z-[1000] bg-white/60 backdrop-blur-xs flex items-center justify-center">
                  <Loader2 className="w-10 h-10 text-rose-600 animate-spin" />
                </div>
              )}

              <MapContainer center={mapCenter} zoom={14} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  attribution="&copy; Google Maps"
                  url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                  subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                />

                {!sessionLoading && !selectedSession && history.length > 0 && <MultiMapBounds sessions={history} />}
                <FlyTo center={flyCenter} zoom={flyZoom} />

                {selectedSession && selectedSession.coordinates && selectedSession.coordinates.length > 0 && (
                  <>
                    <MapBounds coords={selectedSession.coordinates} trigger={selectionTrigger} />

                    {/* Polyline Path if > 1 coordinate */}
                    {selectedSession.coordinates.length > 1 && (
                      <>
                        <Polyline
                          positions={selectedSession.coordinates.map((c) => [c.lat, c.lng])}
                          pathOptions={{ color: '#e11d48', weight: 8, opacity: 0.25 }}
                        />
                        <Polyline
                          positions={selectedSession.coordinates.map((c) => [c.lat, c.lng])}
                          pathOptions={{ color: '#e11d48', weight: 4, opacity: 1, lineCap: 'round', lineJoin: 'round' }}
                        />

                        {/* Start Marker (IN) */}
                        <Marker
                          position={[selectedSession.coordinates[0].lat, selectedSession.coordinates[0].lng]}
                          icon={startIcon}
                        >
                          <Popup>
                            <div className="p-1 min-w-[150px]">
                              <p className="font-bold text-xs text-emerald-600">🟢 Check-In Point</p>
                              <p className="text-[11px] text-slate-700 mt-0.5">{selectedSession.startAddress || 'Start Location'}</p>
                              <p className="text-[10px] text-slate-500 mt-1 font-mono">
                                {new Date(selectedSession.startTime).toLocaleTimeString()}
                              </p>
                            </div>
                          </Popup>
                        </Marker>

                        {/* Stop Markers */}
                        {processTimeline(selectedSession)
                          .filter((e) => e.type === 'Stop' && e.duration >= 15)
                          .map((stop, i) => (
                            <Marker key={`stop-${i}`} position={[stop.lat, stop.lng]} icon={stopIcon}>
                              <Popup>
                                <div className="p-1 min-w-[150px]">
                                  <p className="font-bold text-xs text-amber-600">⏸️ Stationary Stop ({stop.duration} min)</p>
                                  <p className="text-[11px] text-slate-700 mt-0.5">{stop.address || 'Halt location'}</p>
                                  <p className="text-[10px] text-slate-500 mt-1 font-mono">{new Date(stop.time).toLocaleTimeString()}</p>
                                </div>
                              </Popup>
                            </Marker>
                          ))}
                      </>
                    )}

                    {/* End Marker or Live Avatar Marker */}
                    {(() => {
                      const lastCoord = selectedSession.coordinates[selectedSession.coordinates.length - 1];
                      const isLive = selectedSession.isActive || selectedSession.coordinates.length === 1;
                      return (
                        <Marker
                          position={[lastCoord.lat, lastCoord.lng]}
                          icon={
                            isLive
                              ? L.divIcon({
                                  className: 'custom-avatar-marker',
                                  html: `<div style="position:relative;width:42px;height:42px;cursor:pointer;">
                                    <div class="pulse-ring" style="position:absolute;top:-6px;left:-6px;width:54px;height:54px;border-radius:50%;background:#e11d4844;animation:trkPulse 1.8s infinite;"></div>
                                    <div style="position:relative;z-index:2;width:42px;height:42px;border-radius:50%;background:#e11d48;border:3px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,0.35);color:#fff;font-weight:900;font-size:15px;">
                                      ${selectedSession.employee?.name?.[0] || 'E'}
                                    </div>
                                  </div>`,
                                  iconSize: [42, 42],
                                  iconAnchor: [21, 21],
                                })
                              : endIcon
                          }
                        >
                          <Popup>
                            <div className="p-1.5 min-w-[170px]">
                              <div className="flex items-center gap-2 mb-1.5 pb-1 border-b border-slate-100">
                                <div className="w-6 h-6 rounded-full bg-rose-600 text-white font-black text-xs flex items-center justify-center">
                                  {selectedSession.employee?.name?.[0] || 'E'}
                                </div>
                                <div>
                                  <p className="font-black text-xs text-slate-900 leading-none">{selectedSession.employee?.name || 'Field Employee'}</p>
                                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{selectedSession.employee?.employeeId || 'EMP'}</p>
                                </div>
                              </div>
                              <p className={`font-bold text-[11px] ${selectedSession.isActive ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {selectedSession.isActive ? '🟢 Active GPS Live Location' : '🔴 Check-Out Point'}
                              </p>
                              <p className="text-[11px] text-slate-600 mt-1">{lastCoord.address || selectedSession.endAddress || selectedSession.startAddress || 'Location point'}</p>
                              <p className="text-[10px] text-slate-400 mt-1 font-mono">
                                {selectedSession.endTime ? new Date(selectedSession.endTime).toLocaleTimeString() : (lastCoord.timestamp ? new Date(lastCoord.timestamp).toLocaleTimeString() : 'Live')}
                              </p>
                            </div>
                          </Popup>
                        </Marker>
                      );
                    })()}
                  </>
                )}
              </MapContainer>
            </div>

            {/* Selected Shift KM Inspection & Action Bar */}
            {selectedSession && (
              <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-4.5 rounded-2xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-black shrink-0">
                    <Gauge className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Shift Distance Traveled</span>
                      {selectedSession.manualDistanceAdded > 0 && (
                        <span className="text-[10px] font-black text-amber-300 bg-amber-500/20 border border-amber-400/40 px-2 py-0.5 rounded-md">
                          +{selectedSession.manualDistanceAdded} KM Manual Credit
                        </span>
                      )}
                    </div>
                    <div className="text-2xl font-black text-emerald-400 mt-0.5">
                      {(selectedSession.totalDistance || 0).toFixed(2)} <span className="text-sm font-bold text-slate-300">KM</span>
                      <span className="text-xs font-semibold text-slate-400 ml-2">
                        ({selectedSession.employee?.name || 'Employee'})
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => openAdjustModal(selectedSession)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4.5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-xs shadow-md shadow-emerald-500/20 transition active:scale-95 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Adjust / Give Extra KM</span>
                  </button>
                  <button
                    onClick={exportToCSV}
                    className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition cursor-pointer border border-slate-700"
                    title="Download Shift CSV"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Detailed Timeline Breakdown */}
            {selectedSession && (
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-2">
                  <Activity className="w-4 h-4 text-rose-600" />
                  Route & Checkout Timeline Events
                </h4>

                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                  {processTimeline(selectedSession).map((evt, idx) => (
                    <div key={idx} className="flex items-start gap-3 text-xs p-2 rounded-xl hover:bg-slate-50 transition">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-slate-700 flex-shrink-0 mt-0.5">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">{evt.type}</span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            {evt.time ? new Date(evt.time).toLocaleTimeString() : 'Pending'}
                          </span>
                        </div>
                        {evt.address && <p className="text-[11px] text-slate-500 truncate">{evt.address}</p>}
                        {evt.distance && (
                          <p className="text-[11px] text-emerald-600 font-bold mt-0.5">
                            Distance: {evt.distance} km ({evt.duration} min drive)
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ⚡ INTERACTIVE ADJUST / CREDIT KM MODAL */}
        {isAdjustModalOpen && (
          <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              {/* Modal Top Header */}
              <div className="p-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center">
                    <SlidersHorizontal className="w-5 h-5 text-amber-300" />
                  </div>
                  <div>
                    <h3 className="text-base font-black tracking-tight">Adjust / Credit Employee KM</h3>
                    <p className="text-xs text-emerald-100 font-medium">Manually give extra KM or adjust travel distance</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Form Content */}
              <form onSubmit={handleApplyAdjustment} className="p-6 space-y-5">
                {/* 1. Select Employee */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                    Field Employee <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={adjustEmployeeId}
                    onChange={(e) => setAdjustEmployeeId(e.target.value)}
                    disabled={Boolean(adjustTargetSession)}
                    className="w-full px-3.5 py-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-75"
                  >
                    <option value="">Select Employee...</option>
                    {employees.map((e) => (
                      <option key={e._id} value={e._id}>
                        {e.name} ({e.employeeId || 'EMP'}) {e.department ? `• ${e.department}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Target Date */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                    Date of Shift / Travel <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={adjustDate}
                    onChange={(e) => setAdjustDate(e.target.value)}
                    disabled={Boolean(adjustTargetSession)}
                    className="w-full px-3.5 py-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-75"
                  />
                </div>

                {/* 3. Adjustment Mode (Add Extra vs Set Total) */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                    Adjustment Type
                  </label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setAdjustMode('add')}
                      className={`py-2 text-xs font-black rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                        adjustMode === 'add'
                          ? 'bg-white text-emerald-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Extra KM (+)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAdjustMode('set')}
                      className={`py-2 text-xs font-black rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                        adjustMode === 'set'
                          ? 'bg-white text-emerald-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Gauge className="w-3.5 h-3.5" />
                      <span>Set Exact Total (=)</span>
                    </button>
                  </div>
                </div>

                {/* 4. Distance Input with Quick Add Chips */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                      {adjustMode === 'add' ? 'KM to Add (Kilometers)' : 'New Total KM'} <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[11px] font-bold text-slate-500">
                      Current Shift: {((adjustTargetSession?.totalDistance || 0)).toFixed(1)} KM
                    </span>
                  </div>

                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      required
                      placeholder="e.g. 5.5"
                      value={adjustKmValue}
                      onChange={(e) => setAdjustKmValue(e.target.value)}
                      className="w-full px-4 py-3 text-base font-black text-slate-900 bg-slate-50 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 focus:bg-white"
                    />
                    <span className="absolute right-4 top-3.5 text-xs font-black text-slate-400">
                      KM
                    </span>
                  </div>

                  {/* Quick Preset Chips */}
                  <div className="flex items-center gap-1.5 flex-wrap mt-2">
                    {[2, 5, 10, 20, 50].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => {
                          if (adjustMode === 'add') {
                            setAdjustKmValue(num.toString());
                          } else {
                            const cur = adjustTargetSession?.totalDistance || 0;
                            setAdjustKmValue((cur + num).toFixed(1));
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold transition cursor-pointer"
                      >
                        +{num} KM
                      </button>
                    ))}
                  </div>
                </div>

                {/* 5. Adjustment Reason / Audit Note */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                    Reason / Audit Note
                  </label>
                  <input
                    type="text"
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    placeholder="e.g. Client visit approved by Manager"
                    className="w-full px-3.5 py-2.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />

                  {/* Quick Reason Presets */}
                  <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                    {[
                      'GPS offline during highway commute',
                      'Client visit approved by Manager',
                      'Official field allowance adjustment',
                      'Vehicle odometer calibration discrepancy'
                    ].map((presetText) => (
                      <button
                        key={presetText}
                        type="button"
                        onClick={() => setAdjustReason(presetText)}
                        className="text-[10px] font-semibold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-md transition cursor-pointer"
                      >
                        {presetText}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 6. Dynamic Projection Preview */}
                {(() => {
                  const val = parseFloat(adjustKmValue) || 0;
                  const cur = Number(adjustTargetSession?.totalDistance || 0);
                  const newTotal = adjustMode === 'add' ? cur + val : val;
                  const matchedEmp = employees.find((e) => e._id === adjustEmployeeId) || adjustTargetSession?.employee;
                  const taRate = Number(matchedEmp?.TA) || 0;
                  const estimatedPay = taRate > 0 ? (newTotal * taRate).toFixed(2) : null;

                  return (
                    <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-slate-500 font-bold block text-[11px]">CALCULATED NEW DISTANCE:</span>
                        <div className="text-base font-black text-emerald-900 mt-0.5">
                          {newTotal.toFixed(2)} KM {adjustMode === 'add' && val > 0 && <span className="text-xs font-bold text-emerald-700">(+{val.toFixed(1)} KM)</span>}
                        </div>
                      </div>
                      {estimatedPay && (
                        <div className="text-right">
                          <span className="text-slate-500 font-bold block text-[11px]">PROJECTED TA PAY:</span>
                          <span className="text-base font-black text-slate-900 mt-0.5 block">
                            ₹{estimatedPay} <span className="text-[10px] text-slate-500 font-normal">(@ ₹{taRate}/km)</span>
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Modal Actions */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAdjustModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={adjustLoading}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs font-black shadow-md shadow-emerald-600/20 transition active:scale-95 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                  >
                    {adjustLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Applying...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Confirm & Apply KM Credit</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </KisanConnectLayout>
  );
}
