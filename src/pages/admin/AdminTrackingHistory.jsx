import React, { useState, useEffect, useCallback, useRef } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import { adminAPI, trackingAPI } from '../../services/api.service';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import { Calendar, MapPin, Navigation, Clock, ChevronRight, Search, Download, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import L from 'leaflet';

// Custom Marker Icons
const startIcon = L.divIcon({
  className: 'custom-start-marker',
  html: `<div style="width:18px;height:18px;border-radius:50%;background:#22c55e;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;"><div style="width:6px;height:6px;border-radius:50%;background:#fff;"></div></div>`,
  iconSize: [18, 18], iconAnchor: [9, 9],
});
const endIcon = L.divIcon({
  className: 'custom-end-marker',
  html: `<div style="width:18px;height:18px;border-radius:50%;background:#ef4444;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;"><div style="width:6px;height:6px;border-radius:50%;background:#fff;"></div></div>`,
  iconSize: [18, 18], iconAnchor: [9, 9],
});

// Map re-center helper
function MapBounds({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords?.length > 0) {
      const bounds = L.latLngBounds(coords.map(c => [c.lat, c.lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }
  }, [coords, map]);
  return null;
}

export default function AdminTrackingHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [filters, setFilters] = useState({ date: new Date().toISOString().slice(0, 10), employeeId: '' });
  const [employees, setEmployees] = useState([]);
  
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
    if (selectedSession?._id === session._id && selectedSession.coordinates) return;
    
    // If coordinates already exist (unlikely with optimization), just set it
    if (session.coordinates) {
      setSelectedSession(session);
      return;
    }

    setSessionLoading(true);
    try {
      const { data } = await trackingAPI.getSession(session._id);
      if (data.success) {
        setSelectedSession(data.session);
      }
    } catch {
      toast.error('Failed to load session details');
      setSelectedSession(session); // Fallback to session without coords
    } finally {
      setSessionLoading(false);
    }
  };

  const mapCenter = selectedSession?.coordinates?.length > 0
    ? [selectedSession.coordinates[0].lat, selectedSession.coordinates[0].lng]
    : [20.5937, 78.9629];

  const exportToCSV = () => {
    if (!selectedSession || !selectedSession.coordinates) return;
    
    const headers = ['#', 'Time', 'Latitude', 'Longitude', 'Speed (km/h)', 'Accuracy (m)', 'Address'];
    const rows = selectedSession.coordinates.map((c, i) => [
      i + 1,
      new Date(c.timestamp).toLocaleString(),
      c.lat,
      c.lng,
      (c.speed * 3.6).toFixed(1),
      c.accuracy || '',
      c.address || ''
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `tracking_${selectedSession.employee?.name}_${filters.date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AdminLayout>
      <div className="p-4 lg:p-6 space-y-6 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-[var(--text-main)] text-2xl font-bold">Tracking History</h1>
            <p className="text-[var(--text-muted)] text-sm">Review past movement and location logs</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input
                type="date"
                value={filters.date}
                onChange={(e) => setFilters(f => ({ ...f, date: e.target.value }))}
                className="input-field pl-10 py-2 text-sm w-40"
              />
            </div>
            <select
              value={filters.employeeId}
              onChange={(e) => setFilters(f => ({ ...f, employeeId: e.target.value }))}
              className="input-field py-2 text-sm w-48  "
            >
              <option value="">All Employees</option>
              {employees.map(e => <option className='bg-primary-600/10 text-black' key={e._id} value={e._id}>{e.name}</option>)}
            </select>
            <button onClick={fetchHistory} className="btn-primary py-2 px-4 flex items-center gap-2 text-sm">
              <Search className="w-4 h-4" /> Filter
            </button>
            {filters.employeeId && (
              <button 
                onClick={handleDeleteHistory} 
                className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
              >
                Delete All History
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-4 xl:col-span-3 space-y-4 max-h-[calc(100vh-220px)] overflow-y-auto pr-2 custom-scrollbar">
            {loading ? (
              [1, 2, 3].map(i => <div key={i} className="h-28 rounded-2xl bg-[var(--bg-card)] animate-pulse" />)
            ) : history.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <Clock className="w-10 h-10 text-[var(--text-muted)]/20 mx-auto mb-3" />
                <p className="text-[var(--text-muted)] text-sm">No history found for this date</p>
              </div>
            ) : history.map((session) => (
              <div
                key={session._id}
                onClick={() => handleSelectSession(session)}
                className={`glass-card p-4 cursor-pointer transition-all duration-300 border ${
                  selectedSession?._id === session._id
                    ? 'border-primary-500 bg-primary-600/10'
                    : 'border-[var(--border-color)] hover:border-primary-500/50'
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-600/10 flex items-center justify-center font-bold text-primary-500 text-sm">
                    {session.employee?.name?.[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[var(--text-main)] font-bold text-sm truncate">{session.employee?.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="px-1.5 py-0.5 rounded bg-primary-500/10 text-primary-500 text-[9px] font-bold uppercase tracking-wider">
                        {session.employee?.department || 'Staff'}
                      </span>
                      <span className="text-[var(--text-muted)] text-[10px] font-medium">
                        ID: {session.employee?.employeeId}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 transition-transform ${selectedSession?._id === session._id ? 'rotate-90 text-primary-400' : 'text-[var(--text-muted)]'}`} />
                </div>
                <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-[var(--bg-main)]/50">
                  <div className="space-y-0.5">
                    <p className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] font-bold">Start Time</p>
                    <div className="flex items-center gap-1.5 text-[var(--text-main)] font-medium">
                      <Clock className="w-3 h-3 text-primary-500" />
                      <span className="text-[11px]">{new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                  <div className="space-y-0.5 border-l border-[var(--border-color)] pl-3">
                    <p className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] font-bold">Distance</p>
                    <div className="flex items-center gap-1.5 text-emerald-500 font-bold">
                      <Navigation className="w-3 h-3" />
                      <span className="text-[11px]">{(session.totalDistance || 0).toFixed(2)} km</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Main Panel */}
          <div className="lg:col-span-8 xl:col-span-9 space-y-6">
            {/* Map */}
            <div className="glass-card overflow-hidden h-[450px] relative">
              {sessionLoading && (
                <div className="absolute inset-0 z-[1000] bg-[var(--bg-main)]/40 backdrop-blur-[2px] flex items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
                    <p className="text-primary-500 font-bold text-sm">Loading Route Path...</p>
                  </div>
                </div>
              )}
              
              {selectedSession ? (
                <MapContainer center={mapCenter} zoom={14} style={{ height: '100%', width: '100%' }}>
                  <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                  
                  {selectedSession.coordinates?.length > 1 && (
                    <>
                      <MapBounds coords={selectedSession.coordinates} />
                      {/* Outer Glow for Polyline */}
                      <Polyline
                        positions={selectedSession.coordinates.map(c => [c.lat, c.lng])}
                        pathOptions={{ color: '#3b82f6', weight: 8, opacity: 0.2 }}
                      />
                      {/* Main Real Path Line */}
                      <Polyline
                        positions={selectedSession.coordinates.map(c => [c.lat, c.lng])}
                        pathOptions={{ 
                          color: '#3b82f6', 
                          weight: 4, 
                          opacity: 1,
                          lineCap: 'round',
                          lineJoin: 'round',
                          smoothFactor: 1.5 // Improves "Real Path" look by smoothing corners
                        }}
                      />
                      
                      <Marker position={[selectedSession.coordinates[0].lat, selectedSession.coordinates[0].lng]} icon={startIcon}>
                        <Popup>
                          <div className="p-1">
                            <p className="text-[10px] font-bold text-emerald-500 uppercase mb-1">Start Point</p>
                            <p className="text-xs font-semibold">{selectedSession.startAddress || 'Initial Location'}</p>
                            <p className="text-[10px] opacity-60 mt-1">{new Date(selectedSession.startTime).toLocaleTimeString()}</p>
                          </div>
                        </Popup>
                      </Marker>
                      
                      <Marker position={[selectedSession.coordinates[selectedSession.coordinates.length - 1].lat, selectedSession.coordinates[selectedSession.coordinates.length - 1].lng]} icon={endIcon}>
                        <Popup>
                          <div className="p-1">
                            <p className="text-[10px] font-bold text-red-500 uppercase mb-1">End Point</p>
                            <p className="text-xs font-semibold">{selectedSession.endAddress || 'Final Location'}</p>
                            <p className="text-[10px] opacity-60 mt-1">{new Date(selectedSession.endTime || selectedSession.updatedAt).toLocaleTimeString()}</p>
                          </div>
                        </Popup>
                      </Marker>
                    </>
                  )}
                </MapContainer>
              ) : (
                <div className="h-full flex items-center justify-center bg-[var(--bg-main)]/50">
                  <p className="text-[var(--text-muted)]">Select a session to view route</p>
                </div>
              )}
            </div>

            {/* Activity Timeline Table */}
            {selectedSession && selectedSession.coordinates && (
              <div className="glass-card overflow-hidden shadow-xl border-[var(--border-color)]">
                <div className="p-5 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-card)]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-primary-500" />
                    </div>
                    <div>
                      <h3 className="text-[var(--text-main)] font-bold">Activity Timeline</h3>
                      <p className="text-[var(--text-muted)] text-xs">
                        {selectedSession.coordinates.length} locations recorded
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={exportToCSV}
                    className="btn-primary py-2 px-4 !bg-emerald-600 hover:!bg-emerald-500 flex items-center gap-2 text-xs"
                  >
                    <Download className="w-3.5 h-3.5" /> Export Data
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-[var(--bg-main)] text-[var(--text-muted)] font-bold uppercase text-[10px] tracking-widest border-b border-[var(--border-color)]">
                      <tr>
                        <th className="px-5 py-4">#</th>
                        <th className="px-5 py-4">Time</th>
                        <th className="px-5 py-4">Address</th>
                        <th className="px-5 py-4 text-center">Speed</th>
                        <th className="px-5 py-4 text-right">Accuracy</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-color)] bg-[var(--bg-card)]">
                      {selectedSession.coordinates.slice().reverse().map((coord, idx) => {
                        const realIdx = selectedSession.coordinates.length - 1 - idx;
                        const addr = coord.address || `Location (${coord.lat.toFixed(4)}, ${coord.lng.toFixed(4)})`;
                        return (
                          <tr key={idx} className="hover:bg-[var(--bg-card-hover)] transition-colors group">
                            <td className="px-5 py-4 text-[var(--text-muted)] text-xs font-mono">
                              {selectedSession.coordinates.length - idx}
                            </td>
                            <td className="px-5 py-4 text-[var(--text-muted)] whitespace-nowrap font-mono text-xs">
                              {new Date(coord.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </td>
                            <td className="px-5 py-4 text-[var(--text-main)] font-medium max-w-sm">
                              <div className="flex items-start gap-2">
                                <div className="mt-0.5 p-1 rounded bg-primary-500/10 group-hover:bg-primary-500 transition-colors flex-shrink-0">
                                  <MapPin className="w-3 h-3 text-primary-500 group-hover:text-[var(--text-inverse)]" />
                                </div>
                                <div className="min-w-0">
                                  {!addr.startsWith('Location') ? (
                                    <>
                                      <span className="font-semibold text-primary-500 block text-sm truncate">
                                        {addr.split(',')[0]}
                                      </span>
                                      {addr.includes(',') && (
                                        <span className="text-xs text-[var(--text-muted)] line-clamp-1">
                                          {addr.split(',').slice(1).join(',').trim()}
                                        </span>
                                      )}
                                    </>
                                  ) : (
                                    <span className="text-xs text-[var(--text-muted)] font-mono">{addr}</span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <div className="inline-flex flex-col items-center gap-1">
                                <span className="text-emerald-500 font-bold font-mono text-sm">
                                  {Math.round((coord.speed || 0) * 3.6)} <small className="text-[10px]">km/h</small>
                                </span>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-right whitespace-nowrap">
                              <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                                !coord.accuracy ? 'bg-[var(--bg-main)] text-[var(--text-muted)]' :
                                coord.accuracy < 20 ? 'bg-emerald-500/10 text-emerald-500' :
                                coord.accuracy < 50 ? 'bg-amber-500/10 text-amber-500' :
                                'bg-red-500/10 text-red-500'
                              }`}>
                                {coord.accuracy ? `±${coord.accuracy.toFixed(0)}m` : 'N/A'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
