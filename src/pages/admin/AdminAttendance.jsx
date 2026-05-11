import React, { useEffect, useState } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import { adminAPI } from '../../services/api.service';
import toast from 'react-hot-toast';
import { Calendar, Search, CheckCircle, XCircle } from 'lucide-react';

export default function AdminAttendance() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => { fetchRecords(); }, [date]);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const { data } = await adminAPI.getAttendance({ date });
      setRecords(data.records || []);
    } catch { toast.error('Failed to load attendance'); }
    finally { setLoading(false); }
  };

  const present = records.filter(r => r.status === 'present').length;

  return (
    <AdminLayout>
      <div className="p-4 lg:p-6 space-y-5 max-w-5xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-white text-2xl font-bold">Attendance</h1>
            <p className="text-white/40 text-sm">{present} present out of {records.length}</p>
          </div>
          <input type="date" className="input-field w-auto" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Present', value: present, color: 'text-emerald-400' },
            { label: 'Absent', value: records.filter(r => r.status === 'absent').length, color: 'text-red-400' },
            { label: 'Total', value: records.length, color: 'text-white' },
          ].map(s => (
            <div key={s.label} className="glass-card p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{loading ? '—' : s.value}</p>
              <p className="text-white/40 text-xs mt-1">{s.label}</p>
            </div>
          ))}
        </div>
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  {['Employee', 'Check In', 'Check Out', 'Distance', 'Status'].map(h => (
                    <th key={h} className="text-left text-white/40 text-xs font-semibold uppercase tracking-wider px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  [...Array(4)].map((_, i) => <tr key={i}><td colSpan={5} className="px-4 py-3"><div className="h-10 rounded-lg bg-white/5 animate-pulse" /></td></tr>)
                ) : records.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-12 text-white/40">No records for this date</td></tr>
                ) : records.map(r => (
                  <tr key={r._id} className="hover:bg-white/3 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary-600/30 flex items-center justify-center text-primary-300 font-bold text-xs">{r.employee?.name?.[0]}</div>
                        <div>
                          <p className="text-white text-sm font-medium">{r.employee?.name}</p>
                          <p className="text-white/30 text-xs">{r.employee?.employeeId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-white/70 text-sm">{r.checkIn ? new Date(r.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    <td className="px-4 py-3 text-white/70 text-sm">{r.checkOut ? new Date(r.checkOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    <td className="px-4 py-3 text-white/70 text-sm">{(r.totalDistanceTraveled || 0).toFixed(1)} km</td>
                    <td className="px-4 py-3">
                      <span className={`badge capitalize ${r.status === 'present' ? 'badge-green' : r.status === 'absent' ? 'badge-red' : 'badge-yellow'}`}>{r.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
