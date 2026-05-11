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
      <div className="p-4 lg:p-6 space-y-5 max-w-7xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-white text-2xl font-bold">Client Meetings</h1>
            <p className="text-white/40 text-sm">{total} total meetings</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {['', 'scheduled', 'completed', 'follow-up', 'cancelled'].map(s => (
              <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold capitalize transition-all ${statusFilter === s ? 'bg-primary-600 border-primary-500 text-white' : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'}`}>
                {s || 'All'}
              </button>
            ))}
          </div>
        </div>

        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  {['Employee', 'Client', 'Company', 'Deal', 'Date', 'Status'].map(h => (
                    <th key={h} className="text-left text-white/40 text-xs font-semibold uppercase tracking-wider px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i}><td colSpan={6} className="px-4 py-3"><div className="h-10 rounded-lg bg-white/5 animate-pulse" /></td></tr>
                  ))
                ) : meetings.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-white/40">No meetings found</td></tr>
                ) : meetings.map(m => (
                  <tr key={m._id} className="hover:bg-white/3 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-primary-600/30 flex items-center justify-center text-primary-300 font-bold text-xs flex-shrink-0">{m.employee?.name?.[0]}</div>
                        <span className="text-white text-sm font-medium">{m.employee?.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-white text-sm">{m.clientName}</td>
                    <td className="px-4 py-3 text-white/60 text-sm">{m.companyName || '—'}</td>
                    <td className="px-4 py-3 text-emerald-400 font-semibold text-sm">{m.dealAmount > 0 ? `₹${m.dealAmount.toLocaleString()}` : '—'}</td>
                    <td className="px-4 py-3 text-white/60 text-sm">{new Date(m.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td className="px-4 py-3"><span className={`badge ${statusColor[m.status] || 'badge-blue'} capitalize`}>{m.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {total > 15 && (
          <div className="flex items-center justify-center gap-3">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-ghost px-4 py-2 text-sm disabled:opacity-40">← Prev</button>
            <span className="text-white/40 text-sm">{page} / {Math.ceil(total / 15)}</span>
            <button disabled={page * 15 >= total} onClick={() => setPage(p => p + 1)} className="btn-ghost px-4 py-2 text-sm disabled:opacity-40">Next →</button>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

export default AdminMeetings;
