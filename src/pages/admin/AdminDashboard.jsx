import React, { useEffect, useState } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import { adminAPI } from '../../services/api.service';
import { getSocket } from '../../services/socket.service';
import { Users, MapPin, TrendingUp, Receipt, CheckCircle, Activity, Clock, AlertCircle, ClipboardList, Calendar, Navigation } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import toast from 'react-hot-toast';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const PIE_COLORS = ['#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#ef4444'];

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [liveEmployees, setLiveEmployees] = useState([]);

  useEffect(() => {
    fetchStats();
    const socket = getSocket();
    if (socket) {
      socket.on('employee_tracking_started', ({ name }) => {
        toast.success(`📍 ${name} started tracking`);
        fetchStats();
      });
      socket.on('employee_tracking_stopped', ({ name }) => {
        toast(`⏹ ${name} stopped tracking`);
        fetchStats();
      });
      socket.on('new_expense', ({ employeeName }) => toast(`💰 New expense from ${employeeName}`));
      socket.on('new_meeting', ({ employeeName }) => toast(`🤝 New meeting from ${employeeName}`));
    }
    return () => {
      if (socket) {
        socket.off('employee_tracking_started');
        socket.off('employee_tracking_stopped');
        socket.off('new_expense');
        socket.off('new_meeting');
      }
    };
  }, []);

  const fetchStats = async () => {
    try {
      const { data } = await adminAPI.getDashboard();
      setStats(data.stats);
    } catch { toast.error('Failed to load dashboard'); }
    finally { setLoading(false); }
  };

  const monthlyData = stats?.monthlyMeetings?.map(m => ({
    month: MONTHS[m._id - 1], meetings: m.count
  })) || [];

  const pieData = stats?.expenseByCategory?.map(e => ({
    name: e._id, value: e.total
  })) || [];

  const statCards = stats ? [
    { label: 'Attendance', value: stats.todayAttendance, icon: CheckCircle, color: 'text-blue-500', bg: 'bg-blue-500/10', total: stats.totalEmployees, chartData: [
        { name: 'Present', value: stats.todayAttendance, color: '#3b82f6' },
        { name: 'Absent', value: stats.totalEmployees - stats.todayAttendance, color: '#e2e8f0' }
    ]},
    { label: 'Visits', value: stats.totalMeetings, icon: MapPin, color: 'text-emerald-500', bg: 'bg-emerald-500/10', total: 10, chartData: [
        { name: 'Completed', value: stats.totalMeetings, color: '#10b981' },
        { name: 'Pending', value: 2, color: '#e2e8f0' }
    ]},
    { label: 'Tasks', value: stats.totalTasks || 0, icon: ClipboardList, color: 'text-violet-500', bg: 'bg-violet-500/10' },
    { label: 'Leads', value: stats.totalLeads || 0, icon: TrendingUp, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  ] : [];

  const recentVisits = stats?.recentMeetings || [];
  const recentTasks = stats?.recentTasks || [];

  return (
    <AdminLayout>
      <div className="p-4 lg:p-6 space-y-8 max-w-[1600px] mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-[var(--text-main)] text-3xl font-black tracking-tighter uppercase italic">Operational Intel</h1>
            <p className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.3em] mt-2 flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Real-time Field Analytics & Vector Intelligence
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a href="/admin/tasks" className="bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] text-[var(--text-main)] border border-[var(--border-color)] py-2.5 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95">
              <ClipboardList className="w-4 h-4 text-violet-500" /> Dispatch Tasks
            </a>
            <a href="/admin/leaves" className="bg-primary-600 hover:bg-primary-500 text-white py-2.5 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-primary-600/20">
              <Calendar className="w-4 h-4" /> Workforce Leave
            </a>
          </div>
        </div>

        {/* Stats row with Charts */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => <div key={i} className="h-48 rounded-3xl bg-[var(--bg-card)] animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {statCards.map((c, i) => (
              <div key={i} className="glass-card p-6 border-[var(--border-color)] flex flex-col gap-6 group hover:border-primary-500/30 transition-all duration-500 overflow-hidden relative">
                 <div className="absolute top-0 right-0 p-4 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity">
                    <c.icon className="w-24 h-24 rotate-12" />
                 </div>
                 <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-3">
                       <div className={`w-11 h-11 rounded-2xl ${c.bg} border border-[var(--border-color)] flex items-center justify-center shadow-inner`}>
                          <c.icon className={`w-5 h-5 ${c.color}`} />
                       </div>
                       <span className="text-[var(--text-main)] font-black text-[10px] uppercase tracking-[0.2em]">{c.label}</span>
                    </div>
                    <span className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-widest bg-[var(--bg-main)] px-2 py-1 rounded-md">{c.value} / {c.total || '∞'}</span>
                 </div>
                 
                 {c.chartData ? (
                   <div className="h-36 relative z-10">
                      <ResponsiveContainer width="100%" height="100%">
                         <PieChart>
                            <Pie data={c.chartData} innerRadius={42} outerRadius={55} paddingAngle={4} dataKey="value" stroke="none">
                               {c.chartData.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
                            </Pie>
                         </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                         <div className="text-center">
                            <p className="text-[var(--text-main)] font-black text-2xl tracking-tighter leading-none">{c.value}</p>
                            <p className="text-[var(--text-muted)] text-[8px] font-black uppercase tracking-widest mt-1">Status OK</p>
                         </div>
                      </div>
                   </div>
                 ) : (
                   <div className="h-36 flex flex-col items-center justify-center relative z-10">
                      <p className={`text-3xl font-black italic tracking-tighter ${c.color}`}>{c.value}</p>
                      <p className="text-[var(--text-muted)] text-[9px] font-black uppercase tracking-[0.2em] mt-3 opacity-40">System Neutral</p>
                   </div>
                 )}
              </div>
            ))}
          </div>
        )}

        {/* Detailed Tables Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Visits */}
          {/* Recent Visits */}
          <div className="glass-card border-[var(--border-color)] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-5 border-b border-[var(--border-color)] bg-[var(--bg-main)] flex items-center justify-between">
               <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-emerald-500" />
                  </div>
                  <h3 className="text-[var(--text-main)] font-black text-[10px] uppercase tracking-[0.2em]">Field Engagement Log</h3>
               </div>
               <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest bg-[var(--bg-card)] px-2 py-1 rounded-md">Real-time Feed</span>
            </div>
            <div className="overflow-x-auto custom-scrollbar">
               <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[var(--bg-main)] text-[var(--text-muted)] font-black uppercase tracking-[0.2em] text-[9px] border-b border-[var(--border-color)]">
                     <tr>
                        <th className="px-6 py-5">Timestamp</th>
                        <th className="px-6 py-5">Personnel</th>
                        <th className="px-6 py-5">Objective</th>
                        <th className="px-6 py-5">Subject</th>
                        <th className="px-6 py-5">Engagement</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)] bg-[var(--bg-card)]">
                     {recentVisits.length === 0 ? (
                       <tr><td colSpan={5} className="p-12 text-center text-[var(--text-muted)] font-black uppercase text-[10px] tracking-widest italic opacity-30">Archive Synchronization Pending...</td></tr>
                     ) : recentVisits.map((v, i) => (
                       <tr key={i} className="hover:bg-[var(--bg-card-hover)] transition-all group">
                          <td className="px-6 py-5 font-black text-primary-500 italic uppercase text-[10px]">{new Date(v.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                          <td className="px-6 py-5">
                             <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-primary-600/10 border border-primary-500/20 flex items-center justify-center text-[11px] font-black text-primary-400 shadow-inner group-hover:rotate-6 transition-transform">
                                   {v.employee?.name?.[0]}
                                </div>
                                <span className="font-black text-[var(--text-main)] tracking-tight">{v.employee?.name}</span>
                             </div>
                          </td>
                          <td className="px-6 py-5"><span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-500 font-black uppercase text-[8px] border border-blue-500/20">Follow-up</span></td>
                          <td className="px-6 py-5">
                             <div className="flex flex-col">
                                <span className="font-black text-[var(--text-main)] text-[11px] tracking-tight">{v.clientName}</span>
                                <span className="text-[var(--text-muted)] text-[8px] uppercase font-black tracking-widest mt-0.5">{v.companyName || 'Private Unit'}</span>
                             </div>
                          </td>
                          <td className="px-6 py-5">
                             <span className="flex items-center gap-2 text-emerald-500 font-black uppercase text-[8px] tracking-widest">
                                <span className="flex h-1.5 w-1.5 relative">
                                   <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                   <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                </span>
                                Secured
                             </span>
                          </td>
                       </tr>
                     ))}
                  </tbody>
               </table>
            </div>
          </div>

          {/* Tasks Table */}
          <div className="glass-card border-[var(--border-color)] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-5 border-b border-[var(--border-color)] bg-[var(--bg-main)] flex items-center justify-between">
               <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                    <ClipboardList className="w-4 h-4 text-violet-500" />
                  </div>
                  <h3 className="text-[var(--text-main)] font-black text-[10px] uppercase tracking-[0.2em]">Deployment Queue</h3>
               </div>
               <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest bg-[var(--bg-card)] px-2 py-1 rounded-md">Live Status</span>
            </div>
            <div className="overflow-x-auto custom-scrollbar">
               <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[var(--bg-main)] text-[var(--text-muted)] font-black uppercase tracking-[0.2em] text-[9px] border-b border-[var(--border-color)]">
                     <tr>
                        <th className="px-6 py-5">Deadline</th>
                        <th className="px-6 py-5">Personnel</th>
                        <th className="px-6 py-5">Vector</th>
                        <th className="px-6 py-5">Directive</th>
                        <th className="px-6 py-5">Progress</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)] bg-[var(--bg-card)]">
                     {recentTasks.length === 0 ? (
                        <tr><td colSpan={5} className="p-12 text-center text-[var(--text-muted)] font-black uppercase text-[10px] tracking-widest italic opacity-30">No Active Directives...</td></tr>
                     ) : recentTasks.map((t, i) => (
                        <tr key={i} className="hover:bg-[var(--bg-card-hover)] transition-all group">
                           <td className="px-6 py-5 font-black text-[var(--text-main)] text-[10px] uppercase tracking-tighter">{new Date(t.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                           <td className="px-6 py-5 font-black text-[var(--text-main)] tracking-tight">{t.employee?.name}</td>
                           <td className="px-6 py-5">
                              <span className={`px-3 py-1 rounded-full font-black uppercase text-[8px] tracking-widest border ${
                                 t.priority === 'high' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                              }`}>{t.priority}</span>
                           </td>
                           <td className="px-6 py-5 font-black text-[var(--text-main)] text-[11px] tracking-tight">{t.title}</td>
                           <td className="px-6 py-5">
                              <span className="text-amber-500 font-black uppercase text-[8px] tracking-[0.2em] flex items-center gap-2">
                                 <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                 {t.status}
                              </span>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Monthly meetings bar chart */}
          <div className="lg:col-span-8 glass-card p-6 border-[var(--border-color)]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[var(--text-main)] font-bold text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-400" />
                Performance Trends
              </h3>
              <select className="bg-transparent text-[var(--text-muted)] text-xs font-bold border-none focus:ring-0">
                <option>Last 6 Months</option>
                <option>Last Year</option>
              </select>
            </div>
            <div className="h-[300px]">
              {monthlyData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-[var(--text-muted)] text-sm italic">No activity data available for the selected period</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData} barSize={32}>
                    <defs>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.3} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{fill: 'var(--bg-main)', opacity: 0.1}} contentStyle={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-main)', fontSize: '11px', fontWeight: 700 }} />
                    <Bar dataKey="meetings" fill="url(#barGradient)" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Expense by category pie */}
          <div className="lg:col-span-4 glass-card p-6 border-[var(--border-color)]">
            <h3 className="text-[var(--text-main)] font-bold text-lg mb-6 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-red-400" />
              Expenditure
            </h3>
            {pieData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-[var(--text-muted)] text-sm italic">No expense records found</div>
            ) : (
              <div className="space-y-8">
                <div className="h-[200px] relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value" stroke="none">
                        {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-main)', fontSize: '11px', fontWeight: 700 }} formatter={v => `₹${v.toLocaleString()}`} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-widest">Total</p>
                    <p className="text-[var(--text-main)] text-xl font-black">₹{pieData.reduce((a,b)=>a+b.value, 0).toLocaleString()}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {pieData.map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--bg-main)]/30 border border-[var(--border-color)]/30">
                      <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-[var(--text-muted)] text-[11px] font-bold uppercase tracking-wider capitalize">{item.name}</span>
                      </div>
                      <span className="text-[var(--text-main)] text-xs font-black">₹{item.value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Live tracking indicator */}
        {stats?.trackingNow > 0 && (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
            <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
            <p className="text-emerald-300 font-semibold text-sm">
              {stats.trackingNow} employee{stats.trackingNow > 1 ? 's are' : ' is'} currently tracking in the field
            </p>
            <a href="/admin/live-map" className="ml-auto text-emerald-400 text-xs font-semibold hover:text-emerald-300 flex items-center gap-1">
              View Map →
            </a>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
