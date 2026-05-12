import React, { useEffect, useState } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import { adminAPI } from '../../services/api.service';
import { getSocket } from '../../services/socket.service';
import { Users, MapPin, TrendingUp, Receipt, CheckCircle, Activity, Clock, AlertCircle, ClipboardList, Calendar } from 'lucide-react';
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
    { label: 'Total Employees', value: stats.totalEmployees, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', gradient: 'from-blue-500/10 to-transparent' },
    { label: 'Active Now', value: stats.activeEmployees, icon: Activity, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', dot: true, gradient: 'from-emerald-500/10 to-transparent' },
    { label: 'Tracking Now', value: stats.trackingNow, icon: MapPin, color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20', gradient: 'from-violet-500/10 to-transparent' },
    { label: "Attendance", value: stats.todayAttendance, icon: CheckCircle, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', gradient: 'from-amber-500/10 to-transparent' },
    { label: 'Total Meetings', value: stats.totalMeetings, icon: TrendingUp, color: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/20', gradient: 'from-pink-500/10 to-transparent' },
    { label: 'Pending Leaves', value: stats.pendingLeaves || 0, icon: Clock, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', gradient: 'from-cyan-500/10 to-transparent' },
    { label: 'Pending Expenses', value: stats.pendingExpenses, icon: AlertCircle, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', gradient: 'from-orange-500/10 to-transparent' },
    { label: 'Total Expenses', value: `₹${(stats.totalExpenses || 0).toLocaleString()}`, icon: Receipt, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', gradient: 'from-red-500/10 to-transparent' },
  ] : [];

  return (
    <AdminLayout>
      <div className="p-4 lg:p-6 space-y-8 max-w-[1600px] mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[var(--text-main)] text-3xl font-extrabold tracking-tight">Executive Dashboard</h1>
            <p className="text-[var(--text-muted)] text-sm mt-1 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              Real-time field team intelligence & analytics
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a href="/admin/tasks" className="btn-secondary py-2 px-4 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center gap-2">
              <ClipboardList className="w-4 h-4" /> Tasks
            </a>
            <a href="/admin/leaves" className="btn-secondary py-2 px-4 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Leaves
            </a>
          </div>
        </div>

        {/* Stats grid */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => <div key={i} className="h-32 rounded-2xl bg-[var(--bg-card)] animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((c, i) => {
              const Icon = c.icon;
              return (
                <div key={i} className={`group relative glass-card p-5 border ${c.border} overflow-hidden hover:scale-[1.02] transition-all duration-300`}>
                  <div className={`absolute inset-0 bg-gradient-to-br ${c.gradient} opacity-50`} />
                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                        <Icon className={`w-5 h-5 ${c.color}`} />
                      </div>
                      {c.dot && <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.5)]" />}
                    </div>
                    <p className={`text-3xl font-black ${c.color} tracking-tight`}>{c.value}</p>
                    <p className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-widest mt-1 opacity-70">{c.label}</p>
                 </div>
                </div>
              );
            })}
          </div>
        )}

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
