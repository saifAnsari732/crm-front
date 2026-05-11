import React, { useEffect, useState } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import { adminAPI } from '../../services/api.service';
import { getSocket } from '../../services/socket.service';
import { Users, MapPin, TrendingUp, Receipt, CheckCircle, Activity, Clock, AlertCircle } from 'lucide-react';
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
    { label: 'Total Employees', value: stats.totalEmployees, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/20' },
    { label: 'Active Now', value: stats.activeEmployees, icon: Activity, color: 'text-emerald-400', bg: 'bg-emerald-500/20', border: 'border-emerald-500/20', dot: true },
    { label: 'Tracking Now', value: stats.trackingNow, icon: MapPin, color: 'text-violet-400', bg: 'bg-violet-500/20', border: 'border-violet-500/20' },
    { label: "Today's Attendance", value: stats.todayAttendance, icon: CheckCircle, color: 'text-amber-400', bg: 'bg-amber-500/20', border: 'border-amber-500/20' },
    { label: 'Total Meetings', value: stats.totalMeetings, icon: TrendingUp, color: 'text-pink-400', bg: 'bg-pink-500/20', border: 'border-pink-500/20' },
    { label: 'Today Meetings', value: stats.todayMeetings, icon: Clock, color: 'text-cyan-400', bg: 'bg-cyan-500/20', border: 'border-cyan-500/20' },
    { label: 'Pending Expenses', value: stats.pendingExpenses, icon: AlertCircle, color: 'text-orange-400', bg: 'bg-orange-500/20', border: 'border-orange-500/20' },
    { label: 'Total Expenses', value: `₹${(stats.totalExpenses || 0).toLocaleString()}`, icon: Receipt, color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/20' },
  ] : [];

  return (
    <AdminLayout>
      <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto">
        <div>
          <h1 className="text-white text-2xl font-bold">Overview</h1>
          <p className="text-white/40 text-sm">Real-time field team analytics</p>
        </div>

        {/* Stats grid */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[...Array(8)].map((_, i) => <div key={i} className="h-24 rounded-2xl bg-white/5 animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {statCards.map((c, i) => {
              const Icon = c.icon;
              return (
                <div key={i} className={`relative glass-card p-4 border ${c.border} overflow-hidden`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center`}>
                      <Icon className={`w-4 h-4 ${c.color}`} />
                    </div>
                    {c.dot && <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse mt-1" />}
                  </div>
                  <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
                  <p className="text-white/40 text-xs mt-0.5">{c.label}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Monthly meetings bar chart */}
          <div className="glass-card p-5">
            <h3 className="text-white font-semibold mb-4">Monthly Meetings</h3>
            {monthlyData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-white/20 text-sm">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthlyData} barSize={20}>
                  <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff', fontSize: '12px' }} />
                  <Bar dataKey="meetings" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Expense by category pie */}
          <div className="glass-card p-5">
            <h3 className="text-white font-semibold mb-4">Expense Breakdown</h3>
            {pieData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-white/20 text-sm">No data yet</div>
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="60%" height={180}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff', fontSize: '12px' }} formatter={v => `₹${v.toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 flex-1">
                  {pieData.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-white/60 text-xs capitalize flex-1">{item.name}</span>
                      <span className="text-white text-xs font-semibold">₹{item.value.toLocaleString()}</span>
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
