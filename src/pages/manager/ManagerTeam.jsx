import React, { useEffect, useState } from 'react';
import ManagerLayout from '../../components/layout/ManagerLayout';
import { managerAPI } from '../../services/api.service';
import toast from 'react-hot-toast';
import { Search, Users, Activity, CheckCircle, Clock, MapPin } from 'lucide-react';

export default function ManagerTeam() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => { fetchTeam(); }, [page, search]);

  const fetchTeam = async () => {
    setLoading(true);
    try {
      const { data } = await managerAPI.getTeam({ page, limit: 15, search });
      setEmployees(data.employees || []);
      setTotal(data.total || 0);
    } catch {
      toast.error('Failed to load team');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ManagerLayout>
      <div className="p-4 lg:p-6 space-y-6 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-[var(--text-main)] text-2xl font-black tracking-tight flex items-center gap-2">
              <Users className="w-6 h-6 text-blue-500" />
              My Team
            </h1>
            <p className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-widest mt-1">
              {total} employees assigned to you
            </p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              className="input-field pl-10 py-2.5 w-64 text-sm"
              placeholder="Search employee..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>

        {/* Table */}
        <div className="glass-card overflow-hidden border-[var(--border-color)] shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[var(--bg-main)] text-[var(--text-muted)] font-black uppercase tracking-widest text-[10px] border-b border-[var(--border-color)]">
                <tr>
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4">Designation</th>
                  <th className="px-6 py-4">Area</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Connectivity</th>
                  <th className="px-6 py-4">Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)] bg-[var(--bg-card)]">
                {loading ? (
                  [...Array(6)].map((_, i) => (
                    <tr key={i}><td colSpan={6} className="px-6 py-4"><div className="h-12 rounded-xl bg-white/5 animate-pulse" /></td></tr>
                  ))
                ) : employees.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-20 text-[var(--text-muted)] font-bold italic">No employees assigned to you yet</td></tr>
                ) : employees.map(emp => (
                  <tr key={emp._id} className="hover:bg-[var(--bg-card-hover)] transition-all group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-black text-lg shadow-inner group-hover:scale-105 transition-transform uppercase">
                          {emp.name?.[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[var(--text-main)] font-black text-sm tracking-tight truncate">{emp.name}</p>
                          <p className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-widest truncate">{emp.employeeId || 'No ID'}</p>
                          <p className="text-[var(--text-muted)] text-[10px] truncate">{emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-[var(--text-main)] text-xs font-bold">{emp.department || 'General'}</span>
                        <span className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-wider">{emp.designation || 'Staff'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {emp.address?.city ? (
                        <div className="flex items-center gap-1.5 text-[var(--text-muted)] text-xs">
                          <MapPin className="w-3 h-3 text-primary-500" />
                          {emp.address.city}{emp.address.state ? `, ${emp.address.state}` : ''}
                        </div>
                      ) : (
                        <span className="text-[var(--text-muted)] text-[10px]">{emp.allocatedArea || '—'}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {emp.isBlocked ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 text-red-500 text-[9px] font-black uppercase tracking-widest border border-red-500/20">
                          <span className="w-1 h-1 rounded-full bg-red-500" /> Blocked
                        </span>
                      ) : emp.isActive ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-[9px] font-black uppercase tracking-widest border border-emerald-500/20">
                          <span className="w-1 h-1 rounded-full bg-emerald-500" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-500/10 text-slate-500 text-[9px] font-black uppercase tracking-widest border border-slate-500/20">
                          <span className="w-1 h-1 rounded-full bg-slate-500" /> Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${emp.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
                          <span className={`text-[10px] font-black uppercase tracking-widest ${emp.isOnline ? 'text-emerald-500' : 'text-[var(--text-muted)]'}`}>
                            {emp.isOnline ? 'Live Now' : emp.lastSeen ? new Date(emp.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}
                          </span>
                        </div>
                        {emp.isTracking && (
                          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-violet-500/10 border border-violet-500/20 w-fit">
                            <Activity className="w-2.5 h-2.5 text-violet-400" />
                            <span className="text-violet-400 text-[8px] font-black uppercase">Tracking</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {emp.isApproved ? (
                        <div className="flex items-center gap-1.5 text-emerald-500 text-[10px] font-black uppercase tracking-widest">
                          <CheckCircle className="w-3.5 h-3.5" /> Approved
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-amber-500 text-[10px] font-black uppercase tracking-widest">
                          <Clock className="w-3.5 h-3.5" /> Pending
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {total > 15 && (
          <div className="flex items-center justify-center gap-6 py-4">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary px-6 py-2 text-xs font-black uppercase tracking-widest disabled:opacity-40">Prev</button>
            <div className="flex items-center gap-2">
              <span className="text-blue-500 text-sm font-black">{page}</span>
              <span className="text-[var(--text-muted)] text-sm">/</span>
              <span className="text-[var(--text-muted)] text-sm font-bold">{Math.ceil(total / 15)}</span>
            </div>
            <button disabled={page * 15 >= total} onClick={() => setPage(p => p + 1)} className="btn-secondary px-6 py-2 text-xs font-black uppercase tracking-widest disabled:opacity-40">Next</button>
          </div>
        )}
      </div>
    </ManagerLayout>
  );
}
