// AdminMeetings.jsx
import React, { useEffect, useState } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import { meetingAPI } from '../../services/api.service';
import toast from 'react-hot-toast';
import { Search, Users } from 'lucide-react';

const statusColor = { completed: 'badge-green', pending: 'badge-yellow', scheduled: 'badge-blue', 'follow-up': 'badge-yellow', cancelled: 'badge-red' };

export function AdminMeetings() {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => { fetchMeetings(); }, [page, statusFilter]);

  const fetchMeetings = async () => {
    setLoading(true);
    try {
      const { data } = await meetingAPI.getAll({ page, limit: 15, status: statusFilter || undefined });
      setMeetings(data.meetings || []);
      setTotal(data.total || 0);
    } catch { toast.error('Failed'); }
    finally { setLoading(false); }
  };

  return (
    <AdminLayout>
      <div className="p-4 lg:p-6 space-y-6 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-[var(--text-main)] text-2xl font-black tracking-tight flex items-center gap-3">
               <Users className="w-6 h-6 text-primary-500" />
               Client Interaction Audit
            </h1>
            <p className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-widest mt-2">{total} Total Meetings Logged</p>
          </div>
          
          <div className="flex items-center gap-2 bg-[var(--bg-card)] p-1.5 rounded-[1.25rem] border border-[var(--border-color)] shadow-xl overflow-x-auto custom-scrollbar">
            {['', 'scheduled', 'completed', 'follow-up', 'cancelled'].map(s => (
              <button 
                key={s} 
                onClick={() => { setStatusFilter(s); setPage(1); }}
                className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                  statusFilter === s 
                    ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/20' 
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-white/5'
                }`}
              >
                {s || 'All Activity'}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="glass-card overflow-hidden border-[var(--border-color)] shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[var(--bg-main)] text-[var(--text-muted)] font-black uppercase tracking-widest text-[10px] border-b border-[var(--border-color)]">
                <tr>
                  <th className="px-6 py-4">Field Agent</th>
                  <th className="px-6 py-4">Client / Company</th>
                  <th className="px-6 py-4 text-right">Deal Value</th>
                  <th className="px-6 py-4">Interaction Date</th>
                  <th className="px-6 py-4">Engagement Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)] bg-[var(--bg-card)]">
                {loading ? (
                  [...Array(6)].map((_, i) => (
                    <tr key={i}><td colSpan={5} className="px-6 py-4"><div className="h-12 rounded-xl bg-white/5 animate-pulse" /></td></tr>
                  ))
                ) : meetings.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-20 text-[var(--text-muted)] font-black uppercase tracking-widest italic opacity-40">No interaction records found</td></tr>
                ) : meetings.map(m => (
                  <tr key={m._id} className="hover:bg-[var(--bg-card-hover)] transition-all group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary-600/10 border border-primary-500/20 flex items-center justify-center text-primary-400 font-black text-sm shadow-inner group-hover:scale-105 transition-transform uppercase">
                          {m.employee?.name?.[0]}
                        </div>
                        <div>
                          <p className="text-[var(--text-main)] font-black text-sm tracking-tight group-hover:text-primary-400 transition-colors truncate">{m.employee?.name}</p>
                          <p className="text-[var(--text-muted)] text-[9px] font-black uppercase tracking-widest">{m.employee?.department || 'Field Staff'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                         <p className="text-[var(--text-main)] text-sm font-bold group-hover:text-primary-400 transition-colors">{m.clientName}</p>
                         <p className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-widest">{m.companyName || 'Private Entity'}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                       <p className={`font-black text-lg tracking-tight ${m.dealAmount > 0 ? 'text-emerald-500' : 'text-[var(--text-muted)] opacity-30'}`}>
                          {m.dealAmount > 0 ? `₹${m.dealAmount.toLocaleString()}` : '—'}
                       </p>
                    </td>
                    <td className="px-6 py-4">
                       <p className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-widest">
                          {new Date(m.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                       </p>
                    </td>
                    <td className="px-6 py-4">
                       <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                         m.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                         m.status === 'scheduled' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                         m.status === 'cancelled' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                         'bg-amber-500/10 text-amber-500 border-amber-500/20'
                       }`}>
                          <span className={`w-1 h-1 rounded-full ${
                            m.status === 'completed' ? 'bg-emerald-500' :
                            m.status === 'scheduled' ? 'bg-blue-500' :
                            m.status === 'cancelled' ? 'bg-red-500' : 'bg-amber-500'
                          }`} />
                         {m.status}
                       </span>
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
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary px-6 py-2 text-xs font-black uppercase tracking-widest disabled:opacity-40 transition-all active:scale-95">Prev</button>
            <div className="flex items-center gap-2">
               <span className="text-primary-500 text-sm font-black">{page}</span>
               <span className="text-[var(--text-muted)] text-sm">/</span>
               <span className="text-[var(--text-muted)] text-sm font-bold">{Math.ceil(total / 15)}</span>
            </div>
            <button disabled={page * 15 >= total} onClick={() => setPage(p => p + 1)} className="btn-secondary px-6 py-2 text-xs font-black uppercase tracking-widest disabled:opacity-40 transition-all active:scale-95">Next</button>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

export default AdminMeetings;
