import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import { Calendar, CheckCircle, Clock, XCircle, Activity, Download, X, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';
import { adminAPI } from '../../services/api.service';
import toast from 'react-hot-toast';

export default function AdminAttendance() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  // New States
  const [employees, setEmployees] = useState([]);
  const [empFilter, setEmpFilter] = useState('');
  
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [empRecords, setEmpRecords] = useState([]);
  const [calLoading, setCalLoading] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => { 
    fetchRecords(); 
    fetchEmployees();
  }, [date]);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const { data } = await adminAPI.getAttendance({ date });
      setRecords(data.records || []);
    } catch { toast.error('Failed to load attendance'); }
    finally { setLoading(false); }
  };

  const fetchEmployees = async () => {
    try {
      const { data } = await adminAPI.getEmployees({ limit: 200, role: 'all' });
      setEmployees(data.employees || []);
    } catch {}
  };

  const handleEmpClick = async (emp) => {
    setSelectedEmp(emp);
    setCalLoading(true);
    try {
      // Fetch all attendance for this employee
      const { data } = await adminAPI.getAttendance({ employeeId: emp._id });
      setEmpRecords(data.records || []);
    } catch {
      toast.error('Failed to load employee attendance');
    } finally {
      setCalLoading(false);
    }
  };

  const exportToCSV = () => {
    const csvData = [
      ['Name', 'Employee ID', 'Date', 'Status', 'Punch In', 'Punch Out', 'Total Hours'],
      ...filteredRecords.map(r => [
        r.employee?.name,
        r.employee?.employeeId,
        new Date(r.date).toLocaleDateString(),
        r.status,
        r.checkIn ? new Date(r.checkIn).toLocaleTimeString() : '',
        r.checkOut ? new Date(r.checkOut).toLocaleTimeString() : '',
        r.totalWorkHours || 0
      ])
    ].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvData], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = `attendance_${date}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredRecords = records.filter(r => !empFilter || r.employee?._id === empFilter);

  // Calendar Helpers
  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();
  
  const renderCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    
    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-16 sm:h-20 md:h-24 bg-[var(--bg-main)]/30 rounded-xl border border-dashed border-[var(--border-color)]"></div>);
    }
    
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const record = empRecords.find(r => r.date === dateStr);
      
      let statusColor = 'bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-muted)] hover:border-primary-500/30';
      let dotColor = 'bg-gray-400';
      
      if (record) {
        if (record.status === 'present') {
          statusColor = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/20';
          dotColor = 'bg-emerald-500';
        } else if (record.status === 'absent') {
          statusColor = 'bg-red-500/10 border-red-500/30 text-red-500 hover:bg-red-500/20';
          dotColor = 'bg-red-500';
        } else if (record.status === 'leave') {
          statusColor = 'bg-blue-500/10 border-blue-500/30 text-blue-500 hover:bg-blue-500/20';
          dotColor = 'bg-blue-500';
        }
      } else if (new Date(year, month, d) > new Date()) {
        statusColor = 'bg-[var(--bg-main)] border-[var(--border-color)] opacity-40';
      }

      const inTime = record?.checkIn ? new Date(record.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : null;
      const outTime = record?.checkOut ? new Date(record.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : null;

      days.push(
        <div key={d} className={`h-16 sm:h-20 md:h-24 rounded-xl border transition-all duration-200 flex flex-col p-1.5 sm:p-2 relative overflow-hidden cursor-default ${statusColor}`}>
          {/* Date number + status dot */}
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs sm:text-sm font-black leading-none">{d}</span>
            {record && <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${dotColor} flex-shrink-0`} />}
          </div>
          {/* Status label - visible on md+ */}
          {record && (
            <span className="hidden md:block text-[7px] font-black uppercase tracking-widest opacity-70 mb-0.5 truncate">{record.status}</span>
          )}
          {/* IN / OUT times */}
          {record && (
            <div className="mt-auto space-y-0.5">
              {inTime && (
                <div className="flex items-center gap-0.5">
                  <span className="w-1 h-1 rounded-full bg-emerald-500 flex-shrink-0 hidden sm:block" />
                  <span className="text-[8px] sm:text-[9px] font-black text-emerald-600 leading-none truncate">
                    <span className="hidden sm:inline">IN </span>{inTime}
                  </span>
                </div>
              )}
              {outTime ? (
                <div className="flex items-center gap-0.5">
                  <span className="w-1 h-1 rounded-full bg-red-400 flex-shrink-0 hidden sm:block" />
                  <span className="text-[8px] sm:text-[9px] font-black text-red-500 leading-none truncate">
                    <span className="hidden sm:inline">OUT </span>{outTime}
                  </span>
                </div>
              ) : record?.status === 'present' ? (
                <div className="flex items-center gap-0.5">
                  <span className="w-1 h-1 rounded-full bg-amber-400 flex-shrink-0 hidden sm:block" />
                  <span className="text-[8px] sm:text-[9px] font-black text-amber-500 leading-none">
                    <span className="hidden sm:inline">LIVE</span><span className="sm:hidden">●</span>
                  </span>
                </div>
              ) : null}
            </div>
          )}
        </div>
      );
    }
    return days;
  };

  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));

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
          <button onClick={exportToCSV} className="btn-primary py-2.5 px-6 !bg-emerald-600 hover:!bg-emerald-500 flex items-center gap-2 text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 w-full md:w-auto justify-center">
             <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Present', value: filteredRecords.filter(r => r.status === 'present').length, icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
            { label: 'Late', value: 0, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
            { label: 'Absent', value: filteredRecords.filter(r => r.status === 'absent').length, icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10' },
            { label: 'Leave', value: filteredRecords.filter(r => r.status === 'leave').length, icon: Calendar, color: 'text-blue-500', bg: 'bg-blue-500/10' },
          ].map(s => (
            <div key={s.label} className="glass-card p-4 sm:p-5 border-[var(--border-color)] flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl ${s.bg} flex items-center justify-center shadow-inner`}>
                 <s.icon className={`w-5 h-5 sm:w-6 sm:h-6 ${s.color}`} />
              </div>
              <div>
                <p className={`text-xl sm:text-2xl font-black ${s.color}`}>{loading ? '...' : s.value}</p>
                <p className="text-[var(--text-muted)] text-[9px] sm:text-[10px] font-black uppercase tracking-widest mt-0.5">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="glass-card p-4 border-[var(--border-color)] flex flex-col sm:flex-row items-center gap-4 bg-[var(--bg-card)]">
           <div className="flex-1 w-full relative">
              <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1.5 block">Employee Name</label>
              <select value={empFilter} onChange={e => setEmpFilter(e.target.value)} className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl py-2.5 px-4 text-sm font-bold text-[var(--text-main)] focus:border-primary-500 outline-none transition-colors appearance-none">
                 <option value="">All Employees</option>
                 {employees.map(e => (
                   <option key={e._id} value={e._id}>{e.name} ({e.employeeId})</option>
                 ))}
              </select>
           </div>
           <div className="flex-1 w-full relative">
              <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1.5 block">Date</label>
              <input type="date" className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl py-2.5 px-4 text-sm font-bold text-[var(--text-main)] focus:border-primary-500 outline-none transition-colors" value={date} onChange={e => setDate(e.target.value)} />
           </div>
        </div>

        {/* Table */}
        <div className="glass-card overflow-hidden border-[var(--border-color)] shadow-2xl">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full min-w-[800px] text-left">
              <thead className="bg-[var(--bg-main)] text-[var(--text-muted)] font-black uppercase tracking-widest text-[10px] border-b border-[var(--border-color)]">
                <tr>
                  <th className="px-6 py-4">Staff Name</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Punch In</th>
                  <th className="px-6 py-4">Punch Out</th>
                  <th className="px-6 py-4">Total Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)] bg-[var(--bg-card)]">
                {loading ? (
                  [...Array(5)].map((_, i) => <tr key={i}><td colSpan={6} className="px-6 py-4"><div className="h-10 rounded-xl bg-[var(--bg-main)] animate-pulse" /></td></tr>)
                ) : filteredRecords.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-20 text-[var(--text-muted)] font-bold italic">No attendance records found for this criteria</td></tr>
                ) : filteredRecords.map(r => (
                  <tr key={r._id} onClick={() => handleEmpClick(r.employee)} className="hover:bg-[var(--bg-card-hover)] transition-colors group cursor-pointer">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary-600/20 border border-primary-500/20 flex items-center justify-center text-primary-400 font-black text-sm shadow-inner uppercase">
                           {r.employee?.name?.[0]}
                        </div>
                        <div>
                          <p className="text-[var(--text-main)] text-sm font-black tracking-tight group-hover:text-primary-500 transition-colors">{r.employee?.name}</p>
                          <p className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-widest">{r.employee?.employeeId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[var(--text-main)] text-xs font-bold">{new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td className="px-6 py-4">
                       <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                         r.status === 'present' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
                         r.status === 'absent' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                       }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${r.status === 'present' ? 'bg-emerald-500' : r.status === 'absent' ? 'bg-red-500' : 'bg-blue-500'}`} />
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {/* Calendar Modal */}
      {selectedEmp && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-[var(--bg-card)] rounded-t-[2rem] sm:rounded-[2rem] w-full sm:max-w-4xl max-h-[95vh] overflow-hidden flex flex-col shadow-2xl border border-[var(--border-color)]">
            {/* Modal Header */}
            <div className="p-4 sm:p-6 md:p-8 bg-gradient-to-br from-primary-600/10 to-violet-600/10 border-b border-[var(--border-color)] relative flex items-center gap-3 sm:gap-6">
              <button onClick={() => setSelectedEmp(null)} className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2 hover:bg-white/10 rounded-xl transition-colors">
                <X className="w-5 h-5 text-[var(--text-main)]" />
              </button>
              
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center text-white font-black text-xl sm:text-2xl shadow-xl uppercase flex-shrink-0">
                {selectedEmp.name?.[0]}
              </div>
              <div>
                <h2 className="text-lg sm:text-2xl font-black text-[var(--text-main)] tracking-tight">{selectedEmp.name}</h2>
                <p className="text-[var(--text-muted)] text-[10px] sm:text-sm font-bold uppercase tracking-widest">{selectedEmp.employeeId} • {selectedEmp.department || 'Field Staff'}</p>
                {/* Legend */}
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="flex items-center gap-1 text-[9px] font-black text-emerald-600"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"/>IN</span>
                  <span className="flex items-center gap-1 text-[9px] font-black text-red-500"><span className="w-2 h-2 rounded-full bg-red-400 inline-block"/>OUT</span>
                  <span className="flex items-center gap-1 text-[9px] font-black text-amber-500"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block"/>LIVE</span>
                </div>
              </div>
            </div>

            {/* Calendar Content */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-6 md:p-8 custom-scrollbar">
               {/* Calendar Header / Navigation */}
               <div className="flex items-center justify-between mb-4 sm:mb-6">
                 <h3 className="text-base sm:text-xl font-black text-[var(--text-main)] uppercase tracking-widest">
                   {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                 </h3>
                 <div className="flex items-center gap-2">
                   <button onClick={prevMonth} className="p-2 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)] hover:bg-primary-500 hover:text-white hover:border-primary-500 transition-colors">
                     <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                   </button>
                   <button onClick={nextMonth} className="p-2 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)] hover:bg-primary-500 hover:text-white hover:border-primary-500 transition-colors">
                     <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                   </button>
                 </div>
               </div>

               {/* Weekdays */}
               <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
                 {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                   <div key={d} className="text-center text-[9px] sm:text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest py-1 sm:py-2">
                     {d}
                   </div>
                 ))}
               </div>

               {/* Calendar Grid */}
               {calLoading ? (
                 <div className="h-48 flex items-center justify-center">
                    <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                 </div>
               ) : (
                 <div className="grid grid-cols-7 gap-1 sm:gap-2">
                   {renderCalendar()}
                 </div>
               )}
            </div>
            
            {/* Modal Footer */}
            <div className="p-4 sm:p-6 border-t border-[var(--border-color)] flex justify-end">
               <button onClick={() => setSelectedEmp(null)} className="btn-secondary py-2.5 sm:py-3 px-6 sm:px-8 text-xs font-black uppercase tracking-widest">Close</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
