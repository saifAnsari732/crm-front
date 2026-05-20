import React, { useEffect, useState } from 'react';
import ManagerLayout from '../../components/layout/ManagerLayout';
import { managerAPI } from '../../services/api.service';
import toast from 'react-hot-toast';
import { MapPin, Clock, TrendingUp, User, Calendar } from 'lucide-react';

export default function ManagerTravelReport() {
  const [history, setHistory] = useState([]);
  const [summary, setSummary] = useState([]);
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [empFilter, setEmpFilter] = useState('');

  useEffect(() => {
    managerAPI.getTeam({ limit: 100 }).then(({ data }) => setTeam(data.employees || []));
  }, []);

  useEffect(() => { fetchHistory(); }, [date, empFilter]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data } = await managerAPI.getHistory({ date, employeeId: empFilter || undefined, limit: 200 });
      setHistory(data.history || []);
      setSummary(data.summary || []);
    } catch { toast.error('Failed to load travel data'); }
    finally { setLoading(false); }
  };

  // Group by employee for per-person total
  const empTotals = {};
  history.forEach(h => {
    const id = h.employee?._id;
    if (!id) return;
    if (!empTotals[id]) empTotals[id] = { emp: h.employee, totalKm: 0, sessions: 0 };
    empTotals[id].totalKm += h.totalDistance || 0;
    empTotals[id].sessions += 1;
  });
  const totalKmAll = Object.values(empTotals).reduce((a, e) => a + e.totalKm, 0);

  return (
    <ManagerLayout>
      <div className="p-4 lg:p-6 space-y-6 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-[var(--text-main)] text-2xl font-black tracking-tight flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-emerald-500" /> Travel Report
            </h1>
            <p className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-widest mt-1">Distance & tracking data for your team</p>
          </div>
          <div className="flex items-center gap-3">
            <input type="date" className="input-field py-2.5 w-44 text-sm" value={date} onChange={e => setDate(e.target.value)} />
            <select className="input-field py-2.5 w-44 text-sm" value={empFilter} onChange={e => setEmpFilter(e.target.value)}>
              <option value="">All Members</option>
              {team.map(e => <option key={e._id} value={e._id}>{e.name} ({e.designation || 'Staff'})</option>)}
            </select>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-card p-5 border-l-4 border-emerald-500">
            <p className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-widest">Total Distance</p>
            <p className="text-[var(--text-main)] text-3xl font-black mt-1">{totalKmAll.toFixed(1)} <span className="text-sm text-[var(--text-muted)]">km</span></p>
          </div>
          <div className="glass-card p-5 border-l-4 border-primary-500">
            <p className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-widest">Active Members</p>
            <p className="text-[var(--text-main)] text-3xl font-black mt-1">{Object.keys(empTotals).length}</p>
          </div>
          <div className="glass-card p-5 border-l-4 border-violet-500">
            <p className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-widest">Total Sessions</p>
            <p className="text-[var(--text-main)] text-3xl font-black mt-1">{history.length}</p>
          </div>
          <div className="glass-card p-5 border-l-4 border-amber-500">
            <p className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-widest">Avg per Person</p>
            <p className="text-[var(--text-main)] text-3xl font-black mt-1">
              {Object.keys(empTotals).length > 0 ? (totalKmAll / Object.keys(empTotals).length).toFixed(1) : '0'} <span className="text-sm text-[var(--text-muted)]">km</span>
            </p>
          </div>
        </div>

        {/* Per Employee Summary */}
        {Object.keys(empTotals).length > 0 && (
          <div className="glass-card p-6 border-[var(--border-color)]">
            <h2 className="text-[var(--text-main)] font-black uppercase tracking-tight text-sm mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-primary-500" /> Per-Employee Summary
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.values(empTotals).map(({ emp, totalKm, sessions }) => (
                <div key={emp._id} className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--bg-main)] border border-[var(--border-color)] hover:border-primary-500/30 transition-all">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-black text-lg uppercase">
                    {emp.name?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[var(--text-main)] font-black text-sm truncate">{emp.name}</p>
                    <p className="text-[var(--text-muted)] text-[10px] uppercase font-bold">{emp.designation || 'Staff'} • {sessions} session{sessions !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-emerald-500 font-black text-lg">{totalKm.toFixed(1)}</p>
                    <p className="text-[var(--text-muted)] text-[10px] font-bold">km</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detailed Sessions Table */}
        <div className="glass-card overflow-hidden border-[var(--border-color)] shadow-2xl">
          <div className="p-4 border-b border-[var(--border-color)]">
            <h2 className="text-[var(--text-main)] font-black uppercase tracking-tight text-sm flex items-center gap-2">
              <MapPin className="w-4 h-4 text-violet-500" /> Session Details
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[var(--bg-main)] text-[var(--text-muted)] font-black uppercase tracking-widest text-[10px] border-b border-[var(--border-color)]">
                <tr>
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4">From → To</th>
                  <th className="px-6 py-4">Distance</th>
                  <th className="px-6 py-4">Start Time</th>
                  <th className="px-6 py-4">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)] bg-[var(--bg-card)]">
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i}><td colSpan={5} className="px-6 py-4"><div className="h-12 rounded-xl bg-white/5 animate-pulse" /></td></tr>
                  ))
                ) : history.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-20 text-[var(--text-muted)] font-bold italic">No tracking data for this date</td></tr>
                ) : history.map(h => {
                  const start = h.startTime ? new Date(h.startTime) : null;
                  const end = h.endTime ? new Date(h.endTime) : null;
                  const durationMin = start && end ? Math.round((end - start) / 60000) : null;
                  return (
                    <tr key={h._id} className="hover:bg-[var(--bg-card-hover)] transition-all">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 font-black text-sm uppercase">
                            {h.employee?.name?.[0]}
                          </div>
                          <div>
                            <p className="text-[var(--text-main)] font-black text-sm">{h.employee?.name}</p>
                            <p className="text-[var(--text-muted)] text-[10px] uppercase font-bold">{h.employee?.designation || 'Staff'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-0.5">
                          {h.startAddress && <p className="text-[var(--text-muted)] text-[10px] flex items-center gap-1"><MapPin className="w-2.5 h-2.5 text-emerald-500" />{h.startAddress.substring(0, 40)}{h.startAddress.length > 40 ? '...' : ''}</p>}
                          {h.endAddress && <p className="text-[var(--text-muted)] text-[10px] flex items-center gap-1"><MapPin className="w-2.5 h-2.5 text-red-400" />{h.endAddress.substring(0, 40)}{h.endAddress.length > 40 ? '...' : ''}</p>}
                          {!h.startAddress && !h.endAddress && <p className="text-[var(--text-muted)] text-[10px]">—</p>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-emerald-500 font-black text-sm">{(h.totalDistance || 0).toFixed(2)} km</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[var(--text-muted)] text-xs">{start ? start.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[var(--text-muted)] text-xs">
                          {durationMin !== null ? `${Math.floor(durationMin / 60)}h ${durationMin % 60}m` : h.isActive ? <span className="text-emerald-500 text-[10px] font-black uppercase">Live</span> : '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ManagerLayout>
  );
}
