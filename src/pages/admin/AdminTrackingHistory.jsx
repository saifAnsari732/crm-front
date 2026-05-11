import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import { adminAPI } from '../../services/api.service';
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';
import { Calendar, User, MapPin, Navigation, Clock, ChevronRight, Search, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import L from 'leaflet';

// Custom Marker Icons
const startIcon = L.divIcon({
  className: 'custom-start-marker',
  html: `<div class="w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow-lg"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const endIcon = L.divIcon({
  className: 'custom-end-marker',
  html: `<div class="w-4 h-4 rounded-full bg-red-500 border-2 border-white shadow-lg"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export default function AdminTrackingHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
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
      setEmployees(data.employees);
    } catch (err) { toast.error('Failed to load employees'); }
  };

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data } = await adminAPI.getHistory(filters);
      setHistory(data.history);
      if (data.history.length > 0 && !selectedSession) setSelectedSession(data.history[0]);
    } catch (err) { toast.error('Failed to load history'); }
    finally { setLoading(false); }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const mapCenter = selectedSession?.coordinates?.length > 0 
    ? [selectedSession.coordinates[0].lat, selectedSession.coordinates[0].lng]
    : [20.5937, 78.9629];

  return (
    <AdminLayout>
      <div className="p-4 lg:p-6 space-y-6 max-w-[1600px] mx-auto">
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
              className="input-field py-2 text-sm w-48"
            >
              <option value="">All Employees</option>
              {employees.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
            </select>
            <button onClick={fetchHistory} className="btn-primary py-2 px-4 flex items-center gap-2 text-sm">
              <Search className="w-4 h-4" /> Filter
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sidebar: List of Sessions */}
          <div className="lg:col-span-4 xl:col-span-3 space-y-4 max-h-[calc(100vh-220px)] overflow-y-auto pr-2 custom-scrollbar">
            {loading ? (
              [1,2,3].map(i => <div key={i} className="h-28 rounded-2xl bg-[var(--bg-card)] animate-pulse" />)
            ) : history.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <Clock className="w-10 h-10 text-[var(--text-muted)]/20 mx-auto mb-3" />
                <p className="text-[var(--text-muted)] text-sm">No history found for this date</p>
              </div>
            ) : history.map((session) => (
              <div 
                key={session._id}
                onClick={() => setSelectedSession(session)}
                className={`glass-card p-4 cursor-pointer transition-all duration-300 border ${
                  selectedSession?._id === session._id ? 'border-primary-500 bg-primary-600/10' : 'border-[var(--border-color)] hover:border-primary-500/50'
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
                      <span className="text-[11px]">{session.totalDistance.toFixed(2)} km</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Main: Map & Detailed Log */}
          <div className="lg:col-span-8 xl:col-span-9 space-y-6">
            <div className="glass-card overflow-hidden h-[450px] relative">
              {selectedSession ? (
                <MapContainer center={mapCenter} zoom={14} style={{ height: '100%', width: '100%' }}>
                  <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                  {selectedSession.coordinates?.length > 1 && (
                    <>
                      <Polyline 
                        positions={selectedSession.coordinates.map(c => [c.lat, c.lng])}
                        pathOptions={{ color: '#3b82f6', weight: 4, opacity: 0.8 }}
                      />
                      <Marker position={[selectedSession.coordinates[0].lat, selectedSession.coordinates[0].lng]} icon={startIcon}>
                        <Popup>Start Point</Popup>
                      </Marker>
                      <Marker position={[selectedSession.coordinates[selectedSession.coordinates.length - 1].lat, selectedSession.coordinates[selectedSession.coordinates.length - 1].lng]} icon={endIcon}>
                        <Popup>End Point</Popup>
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

            {/* Detailed Address Log */}
            {selectedSession && (
              <div className="glass-card overflow-hidden shadow-xl border-[var(--border-color)]">
                <div className="p-5 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-card)]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-primary-500" />
                    </div>
                    <div>
                      <h3 className="text-[var(--text-main)] font-bold">Activity Timeline</h3>
                      <p className="text-[var(--text-muted)] text-xs">Employee movement log for this session</p>
                    </div>
                  </div>
                  <button className="btn-primary py-2 px-4 !bg-emerald-600 hover:!bg-emerald-500 flex items-center gap-2 text-xs">
                    <Download className="w-3.5 h-3.5" /> Export Data
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-[var(--bg-main)] text-[var(--text-muted)] font-bold uppercase text-[10px] tracking-widest border-b border-[var(--border-color)]">
                      <tr>
                        <th className="px-6 py-4">Timestamp</th>
                        <th className="px-6 py-4">Formatted Address</th>
                        <th className="px-6 py-4 text-center">Movement</th>
                        <th className="px-6 py-4 text-right">Precision</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-color)] bg-[var(--bg-card)]">
                      {selectedSession.coordinates?.slice().reverse().map((coord, idx) => (
                        <tr key={idx} className="hover:bg-[var(--bg-card-hover)] transition-colors group">
                          <td className="px-6 py-5 text-[var(--text-muted)] whitespace-nowrap font-mono text-xs">
                            {new Date(coord.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </td>
                          <td className="px-6 py-5 text-[var(--text-main)] font-medium max-w-lg">
                            <div className="flex items-start gap-3">
                              <div className="mt-1 p-1 rounded bg-primary-500/10 group-hover:bg-primary-500 transition-colors">
                                <MapPin className="w-3 h-3 text-primary-500 group-hover:text-white" />
                              </div>
                              <div>
                                <span className="leading-relaxed block">
                                  {coord.address ? (
                                    <>
                                      <span className="font-bold text-primary-500 block mb-0.5">{coord.address.split(',')[0]}</span>
                                      <span className="text-xs text-[var(--text-muted)] line-clamp-1">{coord.address.split(',').slice(1).join(',')}</span>
                                    </>
                                  ) : 'Location Ping Captured'}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-center">
                            <div className="inline-flex flex-col items-center">
                              <span className="text-emerald-500 font-bold font-mono">{Math.round((coord.speed || 0) * 3.6)} <small>km/h</small></span>
                              <div className="w-12 h-1 bg-[var(--bg-main)] rounded-full mt-1 overflow-hidden">
                                <div 
                                  className="h-full bg-emerald-500" 
                                  style={{ width: `${Math.min(((coord.speed || 0) * 3.6) / 80 * 100, 100)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-right whitespace-nowrap">
                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                              coord.accuracy < 20 ? 'bg-emerald-500/10 text-emerald-500' : 
                              coord.accuracy < 50 ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500'
                            }`}>
                              ±{coord.accuracy?.toFixed(0)}m accuracy
                            </span>
                          </td>
                        </tr>
                      ))}
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
