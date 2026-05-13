import React, { useEffect, useState } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import { adminAPI } from '../../services/api.service';
import toast from 'react-hot-toast';
import { Calendar, Search, CheckCircle, XCircle, Clock, Activity } from 'lucide-react';

export default function AdminAttendance() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [department, setDepartment] = useState('All');
  const [shift, setShift] = useState('All');

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

  const exportToCSV = () => {
    const headers = ['Employee Name', 'Employee ID', 'Check In', 'Check Out', 'Distance (km)', 'Status'];
    const rows = records.map(r => [
      r.employee?.name || '',
      r.employee?.employeeId || '',
      r.checkIn ? new Date(r.checkIn).toLocaleString() : '—',
      r.checkOut ? new Date(r.checkOut).toLocaleString() : '—',
      (r.totalDistanceTraveled || 0).toFixed(2),
      r.status
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `attendance_${date}.csv`);
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
            <h1 className="text-[var(--text-main)] text-2xl font-black tracking-tight flex items-center gap-2">
               <Calendar className="w-6 h-6 text-primary-500" />
               Attendance Overview
            </h1>
            <p className="text-[var(--text-muted)] text-sm font-bold uppercase tracking-widest mt-1">Real-time workforce presence</p>
          </div>
          <button onClick={exportToCSV} className="btn-primary py-2.5 px-6 !bg-emerald-600 hover:!bg-emerald-500 flex items-center gap-2 text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20">
             Export CSV
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Present', value: records.filter(r => r.status === 'present').length, icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
            { label: 'Late', value: 0, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
            { label: 'Absent', value: records.filter(r => r.status === 'absent').length, icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10' },
            { label: 'Leave', value: records.filter(r => r.status === 'leave').length, icon: Calendar, color: 'text-blue-500', bg: 'bg-blue-500/10' },
          ].map(s => (
            <div key={s.label} className="glass-card p-5 border-[var(--border-color)] flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl ${s.bg} flex items-center justify-center`}>
                 <s.icon className={`w-6 h-6 ${s.color}`} />
              </div>
              <div>
                <p className={`text-2xl font-black ${s.color}`}>{loading ? '—' : s.value}</p>
                <p className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-widest mt-0.5">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="glass-card p-4 border-[var(--border-color)] flex flex-wrap items-center gap-4 bg-[var(--bg-card)]">
           <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1.5 block">Department</label>
              <select value={department} onChange={e => setDepartment(e.target.value)} className="input-field py-2 text-sm">
                 <option>All Departments</option>
                 <option>Sales</option>
                 <option>Operations</option>
                 <option>Field Staff</option>
              </select>
           </div>
           <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1.5 block">Shift</label>
              <select value={shift} onChange={e => setShift(e.target.value)} className="input-field py-2 text-sm">
                 <option>All Shifts</option>
                 <option>Day Shift</option>
                 <option>Night Shift</option>
              </select>
           </div>
           <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1.5 block">Date</label>
              <input type="date" className="input-field py-2 text-sm" value={date} onChange={e => setDate(e.target.value)} />
           </div>
        </div>

        {/* Table */}
        <div className="glass-card overflow-hidden border-[var(--border-color)] shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[var(--bg-main)] text-[var(--text-muted)] font-black uppercase tracking-widest text-[10px] border-b border-[var(--border-color)]">
                <tr>
                  <th className="px-6 py-4">Staff Name</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Punch In</th>
                  <th className="px-6 py-4">Punch Out</th>
                  <th className="px-6 py-4">Total Hours</th>
                  <th className="px-6 py-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)] bg-[var(--bg-card)]">
                {loading ? (
                  [...Array(5)].map((_, i) => <tr key={i}><td colSpan={7} className="px-6 py-4"><div className="h-10 rounded-xl bg-white/5 animate-pulse" /></td></tr>)
                ) : records.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-20 text-[var(--text-muted)] font-bold italic">No attendance records found for this criteria</td></tr>
                ) : records.map(r => (
                  <tr key={r._id} className="hover:bg-[var(--bg-card-hover)] transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary-600/20 border border-primary-500/20 flex items-center justify-center text-primary-400 font-black text-sm shadow-inner uppercase">
                           {r.employee?.name?.[0]}
                        </div>
                        <div>
                          <p className="text-[var(--text-main)] text-sm font-black tracking-tight">{r.employee?.name}</p>
                          <p className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-widest">{r.employee?.employeeId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[var(--text-main)] text-xs font-bold">{new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td className="px-6 py-4">
                       <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                         r.status === 'present' ? 'bg-emerald-500/10 text-emerald-500' : 
                         r.status === 'absent' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'
                       }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${r.status === 'present' ? 'bg-emerald-500' : r.status === 'absent' ? 'bg-red-500' : 'bg-amber-500'}`} />
                          {r.status}
                       </span>
                    </td>
                    <td className="px-6 py-4 text-[var(--text-main)] text-xs font-bold">
                       {r.checkIn ? new Date(r.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                    </td>
                    <td className="px-6 py-4 text-[var(--text-main)] text-xs font-bold">
                       {r.checkOut ? new Date(r.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                    </td>
                    <td className="px-6 py-4 text-primary-500 text-xs font-black italic">
                       {r.totalWorkHours ? `${r.totalWorkHours.toFixed(1)} hrs` : '0.0 hrs'}
                    </td>
                    <td className="px-6 py-4">
                       <button className="p-2 rounded-lg bg-[var(--bg-main)] text-[var(--text-muted)] hover:text-primary-500 transition-colors">
                          <Activity className="w-4 h-4" />
                       </button>
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
