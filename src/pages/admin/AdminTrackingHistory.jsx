import React, { useState, useEffect, useCallback, useRef } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import { adminAPI, trackingAPI } from '../../services/api.service';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import { Calendar, MapPin, Navigation, Clock, ChevronRight, Search, Download, Loader2, FileImage,Activity  } from 'lucide-react';
import toast from 'react-hot-toast';
import L from 'leaflet';
import html2canvas from 'html2canvas';

// Custom Marker Icons
const startIcon = L.divIcon({
  className: 'custom-start-marker',
  html: `<div style="width:28px;height:28px;border-radius:10px;background:#22c55e;border:3px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:10px;transform:rotate(45deg);"><div style="transform:rotate(-45deg)">IN</div></div>`,
  iconSize: [28, 28], iconAnchor: [14, 14],
});
const endIcon = L.divIcon({
  className: 'custom-end-marker',
  html: `<div style="width:28px;height:28px;border-radius:10px;background:#ef4444;border:3px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:10px;transform:rotate(45deg);"><div style="transform:rotate(-45deg)">OUT</div></div>`,
  iconSize: [28, 28], iconAnchor: [14, 14],
});
const stopIcon = L.divIcon({
  className: 'custom-stop-marker',
  html: `<div style="width:24px;height:24px;border-radius:50%;background:#f59e0b;border:3px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:10px;">P</div>`,
  iconSize: [24, 24], iconAnchor: [12, 12],
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


// Multi-Marker re-center helper (fits all employees on screen)
function MultiMapBounds({ sessions }) {
  const map = useMap();
  useEffect(() => {
    const validCoords = sessions
      .map(s => s.coordinates?.[0])
      .filter(c => c && c.lat && c.lng); 
    if (validCoords.length > 0) {
      const bounds = L.latLngBounds(validCoords.map(c => [c.lat, c.lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [sessions, map]);
  return null;
}

// Individual Path re-center helper
function MapBounds({ coords, trigger }) {
  const map = useMap();
  useEffect(() => {
    if (coords?.length > 0) {
      const bounds = L.latLngBounds(coords.map(c => [c.lat, c.lng]));
      map.fitBounds(bounds, { padding: [100, 100], maxZoom: 16 });
    }
  }, [coords, map, trigger]);
  return null;
}

// Custom FlyTo helper
function FlyTo({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, zoom || 14, { duration: 1.2 });
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
    icon: 'target'
  });

  let lastEventCoord = coords[0];
  let currentSegment = [];

  for (let i = 1; i < coords.length; i++) {
    const c = coords[i];
    const prev = coords[i - 1];
    
    const timeDiff = (new Date(c.timestamp) - new Date(prev.timestamp)) / (1000 * 60); // minutes
    
    // Stop detection: if time diff is large or speed is very low for a while
    if (timeDiff > 5) {
      // If we were traveling, close that segment
      if (currentSegment.length > 0) {
          const dist = currentSegment.reduce((acc, curr, idx) => {
              if (idx === 0) return 0;
              const p = currentSegment[idx-1];
              const d = L.latLng(p.lat, p.lng).distanceTo(L.latLng(curr.lat, curr.lng)) / 1000;
              return acc + d;
          }, 0);
          
          events.push({
            type: 'Drive',
            duration: Math.round((new Date(prev.timestamp) - new Date(lastEventCoord.timestamp)) / (1000 * 60)),
            distance: dist.toFixed(2),
            icon: 'navigation'
          });
      }

      events.push({
        type: 'Stop',
        time: c.timestamp,
        duration: Math.round(timeDiff),
        address: c.address,
        lat: c.lat,
        lng: c.lng,
        icon: 'map-pin'
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
          const p = currentSegment[idx-1];
          const d = L.latLng(p.lat, p.lng).distanceTo(L.latLng(curr.lat, curr.lng)) / 1000;
          return acc + d;
      }, 0);
      
      events.push({
        type: 'Travel',
        duration: Math.round((new Date(last.timestamp) - new Date(lastEventCoord.timestamp)) / (1000 * 60)),
        distance: dist.toFixed(2),
        icon: 'navigation'
      });
  }

  // 2. Punch Out / Last Known
  const finalCoord = coords[coords.length - 1];
  events.push({
    type: session.isActive ? 'Last Known Location' : 'Punch Out',
    time: session.isActive ? finalCoord.timestamp : (session.endTime || finalCoord.timestamp),
    address: session.isActive ? finalCoord.address : (session.endAddress || finalCoord.address),
    lat: finalCoord.lat,
    lng: finalCoord.lng,
    icon: session.isActive ? 'activity' : 'power'
  });

  return events;
};

export default function AdminTrackingHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [filters, setFilters] = useState({ date: new Date().toISOString().slice(0, 10), employeeId: '' });
  const [employees, setEmployees] = useState([]);
  const [selectionTrigger, setSelectionTrigger] = useState(0);
  const [flyCenter, setFlyCenter] = useState(null);
  const [flyZoom, setFlyZoom] = useState(14);
  const reportRef = useRef(null);
  
  useEffect(() => {
    fetchEmployees();
    fetchHistory();
  }, []);

  const fetchEmployees = async () => {
    try {
      const { data } = await adminAPI.getEmployees({ limit: 100 });
      setEmployees(data.employees || []);
    } catch { toast.error('Failed to load employees'); }
  };

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data } = await adminAPI.getHistory(filters);
      setHistory(data.history || []);
      if (data.history?.length > 0) {
        handleSelectSession(data.history[0]);
      } else {
        setSelectedSession(null);
      }
    } catch { toast.error('Failed to load history'); }
    finally { setLoading(false); }
  };

  const handleDeleteHistory = async () => {
    if (!filters.employeeId) return;
    
    const employeeName = employees.find(e => e._id === filters.employeeId)?.name || 'this employee';
    
    if (!window.confirm(`Are you sure you want to PERMANENTLY DELETE ALL history for ${employeeName}? This action cannot be undone.`)) {
      return;
    }

    try {
      const { data } = await trackingAPI.deleteHistory(filters.employeeId);
      if (data.success) {
        toast.success(data.message);
        fetchHistory(); // Refresh the list
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete history');
    }
  };

  const handleSelectSession = async (session) => {
    setSelectionTrigger(prev => prev + 1);
    if (selectedSession?._id === session._id && selectedSession.coordinates?.length > 1) return;
    
    setSessionLoading(true);
    try {
      const { data } = await trackingAPI.getSession(session._id);
      if (data.success) {
        setSelectedSession(data.session);
      }
    } catch {
      toast.error('Failed to load session details');
      setSelectedSession(session); 
    } finally {
      setSessionLoading(false);
    }
  };

  const mapCenter = selectedSession?.coordinates?.length > 0
    ? [selectedSession.coordinates[0].lat, selectedSession.coordinates[0].lng]
    : [26.8467, 80.9462]; // Default to Lucknow instead of India Center

  const exportToCSV = () => {
    if (!selectedSession || !selectedSession.coordinates) return;
    
    const employee = selectedSession.employee || {};
    const reportDate = new Date(selectedSession.date).toLocaleDateString();
    
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Professional Report Header
    csvContent += `FIELD CRM - TRACKING HISTORY REPORT\n`;
    csvContent += `------------------------------------\n`;
    csvContent += `Employee Name,${employee.name || 'N/A'}\n`;
    csvContent += `Employee ID,${employee.employeeId || 'N/A'}\n`;
    csvContent += `Department,${employee.department || 'N/A'}\n`;
    csvContent += `Date,${reportDate}\n`;
    csvContent += `Total Distance Traveled,${(selectedSession.totalDistance || 0).toFixed(2)} km\n`;
    csvContent += `Start Address,"${(selectedSession.startAddress || 'N/A').replace(/"/g, '""')}"\n`;
    csvContent += `End Address,"${(selectedSession.endAddress || 'N/A').replace(/"/g, '""')}"\n`;
    csvContent += `Start Time,${new Date(selectedSession.startTime).toLocaleTimeString()}\n`;
    csvContent += `End Time,${selectedSession.endTime ? new Date(selectedSession.endTime).toLocaleTimeString() : 'Active'}\n`;
    csvContent += `\n`; // Empty line
    
    // Column Headers
    csvContent += "S.No,Time,Latitude,Longitude,Speed (km/h),Accuracy (m),Address\n";
    
    // Log Data
    selectedSession.coordinates.slice().reverse().forEach((c, i) => {
      const time = new Date(c.timestamp).toLocaleTimeString();
      const addr = `"${(c.address || 'N/A').replace(/"/g, '""')}"`;
      const speed = (c.speed * 3.6).toFixed(1);
      const acc = c.accuracy || 'N/A';
      csvContent += `${i + 1},${time},${c.lat},${c.lng},${speed},${acc},${addr}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Tracking_Report_${employee.name}_${reportDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToImage = async () => {
    if (!selectedSession) return;
    
    toast.loading('Generating Image Report...', { id: 'export-image' });
    
    try {
      // Small delay to ensure the hidden report is rendered
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const element = reportRef.current;
      const canvas = await html2canvas(element, {
        scale: 2, // High resolution
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      const link = document.createElement('a');
      link.download = `Tracking_Report_${selectedSession.employee?.name}_${new Date(selectedSession.date).toLocaleDateString()}.jpg`;
      link.href = dataUrl;
      link.click();
      
      toast.success('Report downloaded as JPEG', { id: 'export-image' });
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate image report', { id: 'export-image' });
    }
  };

  return (
    <AdminLayout>

        <div className="p-4 lg:p-6 space-y-6 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-[var(--text-main)] text-2xl font-black tracking-tight flex items-center gap-3">
               <Activity className="w-6 h-6 text-primary-500" />
               Operational Intelligence
            </h1>
            <p className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-widest mt-1">Reviewing Field Personnel Movement Logs</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 bg-[var(--bg-card)] p-2 rounded-2xl border border-[var(--border-color)] shadow-xl">
            <div className="relative group">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-500 group-hover:scale-110 transition-transform" />
              <input
                type="date"
                value={filters.date}
                onChange={(e) => setFilters(f => ({ ...f, date: e.target.value }))}
                className="input-field pl-10 py-2.5 text-[10px] font-black uppercase w-44 tracking-widest"
              />
            </div>
            <div className="relative group">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-500" />
               <select
                 value={filters.employeeId}
                 onChange={(e) => setFilters(f => ({ ...f, employeeId: e.target.value }))}
                 className="input-field pl-10 py-2.5 text-[10px] font-black uppercase w-52 tracking-widest appearance-none"
               >
                 <option value="" className="bg-[var(--bg-sidebar)]">Operational Personnel</option>
                 {employees.map(e => <option className='bg-[var(--bg-sidebar)]' key={e._id} value={e._id}>{e.name}</option>)}
               </select>
            </div>
            <button onClick={fetchHistory} className="bg-primary-600 hover:bg-primary-500 text-white font-black text-[10px] uppercase tracking-[0.2em] px-6 py-2.5 rounded-xl transition-all active:scale-95 shadow-lg shadow-primary-600/20">
               Execute Audit
            </button>
            {filters.employeeId && (
              <button 
                onClick={handleDeleteHistory} 
                className="bg-red-500  text-white border border-red-500/20 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
              >
                Delete
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-180px)] min-h-[600px]">
          {/* 1. Left Sidebar: Sessions */}
          <div className="w-full lg:w-72 xl:w-80 flex flex-col gap-4 overflow-hidden">
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
              {loading ? (
                [1, 2, 3, 4].map(i => <div key={i} className="h-28 rounded-3xl bg-[var(--bg-card)] animate-pulse border border-[var(--border-color)]" />)
              ) : history.length === 0 ? (
                <div className="glass-card p-12 text-center flex flex-col items-center">
                  <div className="w-16 h-16 rounded-2xl bg-[var(--bg-main)] flex items-center justify-center mb-4">
                     <Clock className="w-8 h-8 text-[var(--text-muted)] opacity-20" />
                  </div>
                  <h3 className="text-[var(--text-main)] font-black text-sm uppercase tracking-tight">Archives Empty</h3>
                  <p className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-widest mt-2">No operational data found for this date.</p>
                </div>
              ) : history.map((session) => (
                <div
                  key={session._id}
                  onClick={() => handleSelectSession(session)}
                  className={`group relative rounded-[1.75rem] p-5 cursor-pointer transition-all duration-500 border-2 ${
                    selectedSession?._id === session._id
                      ? 'bg-primary-600/10 border-primary-500/50 shadow-2xl shadow-primary-500/10'
                      : 'bg-[var(--bg-card)] border-transparent hover:border-primary-500/20 hover:bg-[var(--bg-card-hover)]'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm uppercase transition-all duration-500 ${
                      selectedSession?._id === session._id ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/40 rotate-3' : 'bg-[var(--bg-main)] text-[var(--text-muted)] group-hover:rotate-6'
                    }`}>
                      {session.employee?.name?.[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-[var(--text-main)] font-black text-sm tracking-tight group-hover:text-primary-400 transition-colors truncate ${selectedSession?._id === session._id ? 'text-primary-400' : ''}`}>
                        {session.employee?.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                         <span className={`w-2.5 h-2.5 rounded-full ring-2 ring-[var(--bg-main)] ${session.isActive ? 'bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-[var(--text-muted)]'}`} />
                         <p className="text-[var(--text-muted)] text-[9px] font-black uppercase tracking-[0.1em]">
                           {new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — {session.isActive ? 'LIVE' : new Date(session.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                         </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Center Panel: Map & Summary */}
          <div className="flex-1 flex flex-col gap-4 min-w-0">
            {/* Quick Summary Bar */}
            {selectedSession && (
              <div className="glass-card p-5 flex items-center justify-between border-primary-500/20 bg-gradient-to-r from-primary-600/10 to-violet-600/5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
                   <Navigation className="w-32 h-32 rotate-12" />
                </div>
                
                <div className="flex items-center gap-8 relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-2xl bg-primary-600/10 border border-primary-500/20 flex items-center justify-center text-primary-500 shadow-inner">
                      <Navigation className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[var(--text-muted)] text-[9px] font-black uppercase tracking-widest">Total Displacement</p>
                      <p className="text-[var(--text-main)] font-black text-xl italic tracking-tight">{(selectedSession.totalDistance || 0).toFixed(2)} <span className="text-xs font-bold not-italic text-primary-500">KM</span></p>
                    </div>
                  </div>
                  <div className="w-px h-10 bg-[var(--border-color)] opacity-50" />
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-500 shadow-inner">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[var(--text-muted)] text-[9px] font-black uppercase tracking-widest">Operational Duration</p>
                      <p className="text-[var(--text-main)] font-black text-lg tracking-tight">
                        {selectedSession.endTime 
                          ? `${Math.round((new Date(selectedSession.endTime) - new Date(selectedSession.startTime)) / (1000 * 60 * 60))}h ${Math.round(((new Date(selectedSession.endTime) - new Date(selectedSession.startTime)) / (1000 * 60)) % 60)}m`
                          : <span className="text-emerald-500 uppercase text-sm tracking-widest flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Personnel Live</span>}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 relative z-10">
                   <button onClick={exportToCSV} className="bg-[var(--bg-main)] hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-primary-400 border border-[var(--border-color)] py-2.5 px-5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2">
                     <Download className="w-4 h-4" /> Export CSV
                   </button>
                   <button onClick={exportToImage} className="bg-primary-600 hover:bg-primary-500 text-white py-2.5 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-primary-600/20 flex items-center gap-2">
                     <FileImage className="w-4 h-4" /> JPEG Summary
                   </button>
                </div>
              </div>
            )}

            <div className="flex-1 glass-card overflow-hidden relative border-[var(--border-color)]">
              {sessionLoading && (
                <div className="absolute inset-0 z-[1000] bg-[var(--bg-main)]/40 backdrop-blur-[2px] flex items-center justify-center">
                  <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
                </div>
              )}
              
              <MapContainer center={mapCenter} zoom={14} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  attribution='&copy; Google Maps'
                  url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                  subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                />
                
                {!sessionLoading && history.length > 0 && <MultiMapBounds sessions={history} />}
                <FlyTo center={flyCenter} zoom={flyZoom} />

                {selectedSession?.coordinates?.length > 1 && (
                  <>
                    <MapBounds coords={selectedSession.coordinates} trigger={selectionTrigger} />
                    
                    {/* Professional Path Styling */}
                    <Polyline
                      positions={selectedSession.coordinates.map(c => [c.lat, c.lng])}
                      pathOptions={{ color: '#3b82f6', weight: 12, opacity: 0.15 }}
                    />
                    <Polyline
                      positions={selectedSession.coordinates.map(c => [c.lat, c.lng])}
                      pathOptions={{ color: '#3b82f6', weight: 5, opacity: 1, lineCap: 'round', lineJoin: 'round', dashArray: selectedSession.isActive ? '1, 10' : null }}
                    />
                    {!selectedSession.isActive && (
                      <Polyline
                        positions={selectedSession.coordinates.map(c => [c.lat, c.lng])}
                        pathOptions={{ color: '#3b82f6', weight: 5, opacity: 1, lineCap: 'round', lineJoin: 'round' }}
                      />
                    )}

                    
                    {/* Start/End Markers */}
                    <Marker position={[selectedSession.coordinates[0].lat, selectedSession.coordinates[0].lng]} icon={startIcon} />
                    {!selectedSession.isActive && (
                      <Marker position={[selectedSession.coordinates[selectedSession.coordinates.length - 1].lat, selectedSession.coordinates[selectedSession.coordinates.length - 1].lng]} icon={endIcon} />
                    )}

                    {/* Stop Markers */}
                    {processTimeline(selectedSession)
                      .filter(e => e.type === 'Stop')
                      .map((stop, i) => (
                        <Marker key={`stop-${i}`} position={[stop.lat, stop.lng]} icon={stopIcon}>
                          <Popup>
                            <div className="p-2">
                              <p className="font-black text-xs text-amber-500 uppercase mb-1">Stationary ({stop.duration} min)</p>
                              <p className="text-[10px] font-bold text-[var(--text-main)]">{stop.address || 'Unknown Stop'}</p>
                              <p className="text-[9px] text-[var(--text-muted)] mt-1">{new Date(stop.time).toLocaleTimeString()}</p>
                            </div>
                          </Popup>
                        </Marker>
                      ))}

                    {/* Movement Dots - Filtered for performance and visibility */}
                    {selectedSession.coordinates
                      .filter((_, i) => i % Math.max(1, Math.floor(selectedSession.coordinates.length / 100)) === 0)
                      .map((coord, i) => (
                      <Marker 
                        key={`dot-${i}`}
                        position={[coord.lat, coord.lng]}
                        icon={L.divIcon({
                          className: 'path-dot',
                          html: `<div style="width:8px;height:8px;border-radius:50%;background:#3b82f6;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>`,
                          iconSize: [8, 8], iconAnchor: [4, 4]
                        })}
                      >
                        <Popup>
                          <div className="p-1">
                            <p className="text-[10px] font-black text-primary-500">{new Date(coord.timestamp).toLocaleTimeString()}</p>
                            <p className="text-[10px] font-bold text-[var(--text-main)]">Speed: {Math.round((coord.speed || 0) * 3.6)} km/h</p>
                          </div>
                        </Popup>
                      </Marker>
                    ))}

                    {/* Live Pulse if active */}
                     {selectedSession.isActive && (
                      <Marker 
                        position={[selectedSession.coordinates[selectedSession.coordinates.length - 1].lat, selectedSession.coordinates[selectedSession.coordinates.length - 1].lng]}
                        icon={L.divIcon({
                          className: 'live-pulse-marker',
                          html: `
                            <div style="position:relative;width:34px;height:34px;">
                              <div class="pulse-ring" style="top:-7px;left:-7px;width:48px;height:48px;"></div>
                              <div style="position:relative;z-index:2;width:34px;height:34px;border-radius:50%;background:#3b82f6;border:3px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:14px;box-shadow:0 4px 12px rgba(59,130,246,0.5);">
                                ${selectedSession.employee?.name?.[0].toUpperCase()}
                                <div class="inner-pulse" style="position:absolute;width:8px;height:8px;border-radius:50%;background:#fff;top:-2px;right:-2px;border:2px solid #3b82f6;"></div>
                              </div>
                            </div>`,
                          iconSize: [34, 34],
                          iconAnchor: [17, 17]
                        })}
                      />
                    )}

                  </>
                )}
              </MapContainer>
            </div>
          </div>

          {/* 3. Right Sidebar: Activity Timeline */}
          <div className="w-full lg:w-80 xl:w-96 flex flex-col glass-card border-[var(--border-color)] overflow-hidden">
            <div className="p-4 border-b border-[var(--border-color)] bg-[var(--bg-card)]">
              <h3 className="text-[var(--text-main)] font-black text-sm uppercase tracking-widest flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary-500" /> Timeline
              </h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {!selectedSession ? (
                <div className="h-full flex items-center justify-center text-[var(--text-muted)] text-sm italic">
                  Select a session to view timeline
                </div>
              ) : (
                <div className="relative pl-6 space-y-8">
                  {/* Vertical Line */}
                  <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-[var(--border-color)]" />
                  
                  {processTimeline(selectedSession).map((event, idx) => (
                    <div key={idx} className="relative group">
                      {/* Timeline Dot/Icon */}
                      <div className={`absolute -left-[29px] top-1 w-6 h-6 rounded-full border-4 border-[var(--bg-sidebar)] z-10 flex items-center justify-center transition-transform group-hover:scale-110 ${
                        event.type.includes('Punch In') ? 'bg-emerald-500' :
                        event.type.includes('Punch Out') ? 'bg-red-500' :
                        event.type === 'Stop' ? 'bg-amber-500' : 'bg-primary-500'
                      }`}>
                         {event.icon === 'target' && <div className="w-2.5 h-2.5 rounded-full bg-white shadow-sm" />}
                         {event.icon === 'power' && <div className="w-2.5 h-2.5 bg-white rounded-sm shadow-sm" />}
                         {event.icon === 'map-pin' && <div className="w-2 h-2 rounded-full bg-white shadow-sm" />}
                         {event.icon === 'navigation' && <Navigation className="w-3.5 h-3.5 text-white fill-white drop-shadow-sm" />}
                      </div>

                      <div className="bg-[var(--bg-card)] rounded-xl p-3 border border-[var(--border-color)] group-hover:border-primary-500/30 transition-all">
                        <div className="flex items-center justify-between mb-1">
                          <p className={`font-black text-xs uppercase tracking-wider ${
                            event.type.includes('Punch In') ? 'text-emerald-500' :
                            event.type.includes('Punch Out') ? 'text-red-500' :
                            event.type === 'Stop' ? 'text-amber-500' : 'text-primary-500'
                          }`}>
                            {event.type}
                          </p>
                          {event.time && (
                            <span className="text-[10px] font-mono font-bold text-[var(--text-muted)]">
                              {new Date(event.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>

                        {event.address && (
                          <div 
                            className="flex flex-col gap-1 cursor-pointer group/addr"
                            onClick={() => {
                                setFlyCenter([event.lat, event.lng]);
                                setFlyZoom(18);
                                setSelectionTrigger(t => t + 1);
                            }}
                          >
                            <p className="text-[var(--text-main)] text-xs font-semibold leading-tight group-hover/addr:text-primary-500 transition-colors">
                              {event.address}
                            </p>
                          </div>
                        )}

                        {event.duration && (
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[var(--text-muted)] text-[10px] font-bold uppercase">{event.duration} min</span>
                            {event.distance && <span className="text-[var(--text-muted)] text-[10px] font-bold uppercase">• {event.distance} km</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
{/* close Main Panel */}
        </div>{/* close Grid */}
        

        {/* Hidden JPEG Report Template */}
        <div style={{ position: 'absolute', left: '-9999px', top: '0' }}>
          <div ref={reportRef} className="w-[800px] bg-white p-10 text-slate-900 font-sans">
            <div className="flex justify-between items-start border-b-4 border-primary-600 pb-6 mb-8">
              <div>
                <h1 className="text-4xl font-black text-primary-600 tracking-tighter uppercase">Field CRM</h1>
                <p className="text-slate-500 font-bold tracking-widest text-xs mt-1 uppercase">Official Tracking Report</p>
              </div>
              <div className="text-right">
                <p className="text-slate-400 text-[10px] font-black uppercase">Report ID</p>
                <p className="font-bold text-sm">TRK-{selectedSession?._id?.slice(-8).toUpperCase()}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 mb-10">
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest">Employee Information</p>
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Full Name</p>
                    <p className="text-lg font-black text-slate-800">{selectedSession?.employee?.name}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Employee ID</p>
                      <p className="font-bold">{selectedSession?.employee?.employeeId || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Department</p>
                      <p className="font-bold">{selectedSession?.employee?.department || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-primary-600 p-6 rounded-2xl text-white shadow-xl shadow-primary-500/20">
                <p className="text-[10px] font-black text-primary-200 uppercase mb-4 tracking-widest">Session Summary</p>
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[10px] text-primary-200 uppercase font-bold">Total Distance</p>
                      <p className="text-4xl font-black italic">{(selectedSession?.totalDistance || 0).toFixed(2)} <span className="text-lg">KM</span></p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-primary-200 uppercase font-bold">Date</p>
                      <p className="font-black">{new Date(selectedSession?.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="h-px bg-white/20 w-full"></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] text-primary-200 uppercase font-bold">Session Start (ON)</p>
                      <p className="font-black text-lg">{new Date(selectedSession?.startTime).toLocaleTimeString()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-primary-200 uppercase font-bold">Session Stop (OFF)</p>
                      <p className="font-black text-lg">{selectedSession?.endTime ? new Date(selectedSession?.endTime).toLocaleTimeString() : 'Active'}</p>
                    </div>
                      </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter border-l-4 border-primary-600 pl-3">Movement Details</h3>
              <div className="border border-slate-100 rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="p-4 text-[10px] font-black uppercase text-slate-400">Action</th>
                      <th className="p-4 text-[10px] font-black uppercase text-slate-400">Time</th>
                      <th className="p-4 text-[10px] font-black uppercase text-slate-400">Location / Address</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    <tr>
                      <td className="p-4">
                        <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">Tracking ON</span>
                      </td>
                      <td className="p-4 font-black text-slate-700">{new Date(selectedSession?.startTime).toLocaleTimeString()}</td>
                      <td className="p-4 text-xs font-bold text-slate-500">{selectedSession?.startAddress || 'Initial Location'}</td>
                    </tr>
                    {selectedSession?.coordinates?.length > 2 && (
                      <tr>
                        <td className="p-4" colSpan={3}>
                          <div className="flex flex-col items-center py-6 space-y-2">
                            <div className="w-1 h-1 bg-slate-200 rounded-full"></div>
                            <div className="w-1 h-1 bg-slate-200 rounded-full"></div>
                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest py-2 italic">Detailed movement logs recorded ({selectedSession.coordinates.length} points tracked)</p>
                            <div className="w-1 h-1 bg-slate-200 rounded-full"></div>
                            <div className="w-1 h-1 bg-slate-200 rounded-full"></div>
                          </div>
                          </td>
                      </tr>
                    )}
                    {selectedSession?.endTime && (
                      <tr className="bg-slate-50/50">
                        <td className="p-4">
                          <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">Tracking OFF</span>
                        </td>
                        <td className="p-4 font-black text-slate-700">{new Date(selectedSession.endTime).toLocaleTimeString()}</td>
                        <td className="p-4 text-xs font-bold text-slate-500">{selectedSession.endAddress || 'Final Location'}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-12 pt-8 border-t border-slate-100 flex justify-between items-center">
              <div>
                <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">System Generated Authentic Report</p>
                <p className="text-[9px] text-slate-300 italic">Downloaded on: {new Date().toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-primary-600 tracking-tighter">FIELD CRM VERIFIED</p>
                <div className="w-24 h-1 bg-primary-600 ml-auto mt-1"></div>
              </div>
            </div>
          </div>
        </div>
    </AdminLayout>
  );
}
