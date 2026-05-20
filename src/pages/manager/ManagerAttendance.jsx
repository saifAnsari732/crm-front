import React, { useEffect, useState } from 'react';
import ManagerLayout from '../../components/layout/ManagerLayout';
import { managerAPI } from '../../services/api.service';
import toast from 'react-hot-toast';
import { Calendar, Search } from 'lucide-react';

export default function ManagerAttendance() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => { fetchAttendance(); }, [date]);

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const { data } = await managerAPI.getAttendance({ date });
      setRecords(data.records || []);
    } catch {
      toast.error('Failed to load attendance');
    } finally {
      setLoading(false);
    }
  };

  const statusColors = {
    present: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    absent: 'bg-red-500/10 text-red-500 border-red-500/20',
    leave: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    half_day: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  };

  return (
    <ManagerLayout>
      <div className="p-4 lg:p-6 space-y-6 max-w-[1600px] mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-[var(--text-main)] text-2xl font-black tracking-tight flex items-center gap-2">
              <Calendar className="w-6 h-6 text-primary-500" />
              Team Attendance
            </h1>
            <p className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-widest mt-1">{records.length} records for selected date</p>
          </div>
          <input type="date" className="input-field py-2.5 w-44 text-sm" value={date} onChange={e => setDate(e.target.value)} />
        </div>

        <div className="glass-card overflow-hidden border-[var(--border-color)] shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[var(--bg-main)] text-[var(--text-muted)] font-black uppercase tracking-widest text-[10px] border-b border-[var(--border-color)]">
                <tr>
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4">Check In</th>
                  <th className="px-6 py-4">Check Out</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)] bg-[var(--bg-card)]">
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i}><td colSpan={4} className="px-6 py-4"><div className="h-12 rounded-xl bg-white/5 animate-pulse" /></td></tr>
                  ))
                ) : records.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-20 text-[var(--text-muted)] font-bold italic">No attendance records for this date</td></tr>
                ) : records.map(rec => (
                  <tr key={rec._id} className="hover:bg-[var(--bg-card-hover)] transition-all">
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-[var(--text-main)] font-black text-sm">{rec.employee?.name}</p>
                        <p className="text-[var(--text-muted)] text-[10px] uppercase font-bold">{rec.employee?.employeeId}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[var(--text-main)] text-xs font-bold">
                        {rec.checkIn ? new Date(rec.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[var(--text-main)] text-xs font-bold">
                        {rec.checkOut ? new Date(rec.checkOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${statusColors[rec.status] || ''}`}>
                        <span className="w-1 h-1 rounded-full bg-current" />{rec.status?.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ManagerLayout>
  );
}
