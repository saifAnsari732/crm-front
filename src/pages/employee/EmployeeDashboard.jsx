import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import EmployeeLayout from '../../components/layout/EmployeeLayout';
import { adminAPI, attendanceAPI, meetingAPI, expenseAPI, trackingAPI } from '../../services/api.service';
import {
  MapPin, Users, Receipt, TrendingUp, Clock, ChevronRight,
  Navigation, CheckCircle, AlertCircle, Calendar, Zap, ClipboardList, Locate
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ meetings: 0, expenses: 0, distance: 0, attended: false });
  const [loading, setLoading] = useState(true);
  const [recentMeetings, setRecentMeetings] = useState([]);
  const [recentExpenses, setRecentExpenses] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [meetRes, expRes, attRes, trackRes] = await Promise.allSettled([
        meetingAPI.getMy({ limit: 3 }),
        expenseAPI.getMy({ limit: 3 }),
        attendanceAPI.getToday(),
        trackingAPI.getToday(),
      ]);

      if (meetRes.status === 'fulfilled') {
        setRecentMeetings(meetRes.value.data.meetings || []);
        setStats(s => ({ ...s, meetings: meetRes.value.data.total || 0 }));
      }
      if (expRes.status === 'fulfilled') {
        setRecentExpenses(expRes.value.data.expenses || []);
        const totalAmt = (expRes.value.data.expenses || []).reduce((a, e) => a + e.amount, 0);
        setStats(s => ({ ...s, expenses: totalAmt }));
      }
      if (attRes.status === 'fulfilled') {
        setStats(s => ({ ...s, attended: !!attRes.value.data.record }));
      }
      if (trackRes.status === 'fulfilled') {
        const sessions = trackRes.value.data.sessions || [];
        const dist = sessions.reduce((a, s) => a + (s.totalDistance || 0), 0);
        setStats(s => ({ ...s, distance: dist }));
      }
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      label: 'Distance Today', value: `${stats.distance.toFixed(1)} km`,
      icon: Navigation, color: 'from-blue-500/20 to-blue-600/5', iconColor: 'text-blue-400', border: 'border-blue-500/20'
    },
    {
      label: 'Meetings', value: stats.meetings,
      icon: Users, color: 'from-violet-500/20 to-violet-600/5', iconColor: 'text-violet-400', border: 'border-violet-500/20'
    },
    {
      label: 'Expenses', value: `₹${stats.expenses.toLocaleString()}`,
      icon: Receipt, color: 'from-amber-500/20 to-amber-600/5', iconColor: 'text-amber-400', border: 'border-amber-500/20'
    },
    {
      label: 'Status', value: stats.attended ? 'Present' : 'Absent',
      icon: CheckCircle, color: stats.attended ? 'from-emerald-500/20 to-emerald-600/5' : 'from-red-500/20 to-red-600/5',
      iconColor: stats.attended ? 'text-emerald-400' : 'text-red-400',
      border: stats.attended ? 'border-emerald-500/20' : 'border-red-500/20'
    },
  ];

  const quickActions = [
    { label: 'Start Tracking', icon: MapPin, color: 'bg-primary-600 hover:bg-primary-500 shadow-glow shadow-primary-600/30', to: '/tracking' },
    { label: 'My Tasks', icon: ClipboardList, color: 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/20', to: '/tasks' },
    { label: 'Apply Leave', icon: Calendar, color: 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/20', to: '/leaves' },
    { label: 'Add Meeting', icon: Users, color: 'bg-violet-600 hover:bg-violet-500 shadow-lg shadow-violet-600/20', to: '/meetings' },
    { label: 'Add Expense', icon: Receipt, color: 'bg-amber-600 hover:bg-amber-500 shadow-lg shadow-amber-600/20', to: '/expenses' },
  ];

  return (
    <EmployeeLayout>
      <div className="p-4 lg:p-6 space-y-8 max-w-5xl mx-auto pb-24 lg:pb-6">
        {/* Welcome card */}
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary-600 via-primary-700 to-violet-800 border border-white/20 p-8 shadow-2xl shadow-primary-900/20">
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/10 blur-3xl -translate-y-12 translate-x-12" />
          <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-primary-400/10 blur-3xl translate-y-12 -translate-x-12" />
          
          <div className="relative">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-primary-100/60 text-[10px] font-black uppercase tracking-[0.2em] mb-2">
                  {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                <h2 className="text-white text-3xl font-black mb-2 tracking-tight">
                  Hi, {user?.name?.split(' ')[0]}! 👋
                </h2>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="px-3 py-1 rounded-full bg-white/10 border border-white/10 text-white/80 text-[10px] font-bold uppercase tracking-wider">
                    {user?.department}
                  </span>
                  <span className="px-3 py-1 rounded-full bg-white/10 border border-white/10 text-white/80 text-[10px] font-bold uppercase tracking-wider">
                    {user?.designation || 'Field Executive'}
                  </span>
                </div>
              </div>
              <div className="w-16 h-16 rounded-[1.25rem] bg-white/10 border border-white/20 p-1 flex-shrink-0 backdrop-blur-md shadow-xl">
                {user?.avatar ? (
                  <img src={user.avatar} alt="" className="w-full h-full rounded-[1rem] object-cover" />
                ) : (
                  <div className="w-full h-full rounded-[1rem] bg-primary-500/20 flex items-center justify-center text-2xl">👤</div>
                )}
              </div>
            </div>
            
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <div className={`px-4 py-2 rounded-2xl flex items-center gap-2 border ${
                stats.attended ? 'bg-emerald-400/10 border-emerald-400/20' : 'bg-red-400/10 border-red-400/20'
              }`}>
                <div className={`w-2 h-2 rounded-full ${stats.attended ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                <span className="text-white text-[10px] font-black uppercase tracking-widest">
                  {stats.attended ? 'Status: Active' : 'Status: Offline'}
                </span>
              </div>
              <button 
                onClick={() => {
                  if ("geolocation" in navigator) {
                    navigator.geolocation.getCurrentPosition(
                      () => toast.success("Location enabled!"),
                      (err) => toast.error(`Error: ${err.message}`)
                    );
                  } else {
                    toast.error("Geolocation not supported");
                  }
                }}
                className="px-4 py-2 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 flex items-center gap-2 text-white transition-all active:scale-95"
              >
                <Locate className="w-3.5 h-3.5 text-primary-300" />
                <span className="text-[10px] font-black uppercase tracking-widest">Enable Location</span>
              </button>
              <span className="text-white/40 text-[10px] font-bold tracking-widest uppercase hidden md:inline">EMP ID: {user?.employeeId}</span>
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card, i) => {
            const Icon = card.icon;
            return (
              <div key={i} className={`group relative overflow-hidden rounded-[1.5rem] bg-gradient-to-br ${card.color} border ${card.border} p-6 hover:scale-[1.03] transition-all duration-300 shadow-lg shadow-black/5`}>
                <div className="relative z-10">
                  <div className={`w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-4 group-hover:rotate-12 transition-transform`}>
                    <Icon className={`w-5 h-5 ${card.iconColor}`} />
                  </div>
                  <p className="text-white text-2xl font-black tracking-tight">{loading ? '—' : card.value}</p>
                  <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mt-1">{card.label}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Actions (Mobile-Friendly Horizontal Scroll) */}
        <div>
          <h3 className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em] mb-4 ml-1">Quick Operations</h3>
          <div className="flex lg:grid lg:grid-cols-5 gap-4 overflow-x-auto pb-4 no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0">
            {quickActions.map((a, i) => {
              const Icon = a.icon;
              return (
                <button key={i} onClick={() => navigate(a.to)}
                  className={`${a.color} text-white rounded-[1.5rem] p-5 flex flex-col items-center gap-3 transition-all duration-300 active:scale-95 flex-shrink-0 w-32 lg:w-auto hover:-translate-y-1`}>
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-center leading-tight">{a.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Recent Meetings */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold text-sm">Recent Meetings</h3>
            <button onClick={() => navigate('/meetings')} className="text-primary-400 text-xs flex items-center gap-1 hover:text-primary-300">
              View all <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map(i => <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />)}
            </div>
          ) : recentMeetings.length === 0 ? (
            <EmptyState icon="🤝" text="No meetings recorded yet" />
          ) : (
            <div className="space-y-2">
              {recentMeetings.map(m => (
                <div key={m._id} className="glass-card p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5 text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm truncate">{m.clientName}</p>
                    <p className="text-white/40 text-xs truncate">{m.companyName} • {new Date(m.date).toLocaleDateString('en-IN')}</p>
                  </div>
                  <StatusBadge status={m.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Expenses */}
        <div className="pb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold text-sm">Recent Expenses</h3>
            <button onClick={() => navigate('/expenses')} className="text-primary-400 text-xs flex items-center gap-1 hover:text-primary-300">
              View all <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          {loading ? (
            <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />)}</div>
          ) : recentExpenses.length === 0 ? (
            <EmptyState icon="🧾" text="No expenses submitted yet" />
          ) : (
            <div className="space-y-2">
              {recentExpenses.map(exp => (
                <div key={exp._id} className="glass-card p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-xl flex-shrink-0">
                    {categoryEmoji(exp.category)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm capitalize">{exp.category}</p>
                    <p className="text-white/40 text-xs">{new Date(exp.date).toLocaleDateString('en-IN')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-bold text-sm">₹{exp.amount.toLocaleString()}</p>
                    <StatusBadge status={exp.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </EmployeeLayout>
  );
}

function StatusBadge({ status }) {
  const map = {
    completed: 'badge-green', approved: 'badge-green',
    pending: 'badge-yellow', scheduled: 'badge-blue',
    rejected: 'badge-red', cancelled: 'badge-red',
    'follow-up': 'badge-yellow',
  };
  return <span className={`badge ${map[status] || 'badge-blue'} capitalize`}>{status}</span>;
}

function EmptyState({ icon, text }) {
  return (
    <div className="glass-card p-6 text-center">
      <div className="text-3xl mb-2">{icon}</div>
      <p className="text-white/40 text-sm">{text}</p>
    </div>
  );
}

function categoryEmoji(cat) {
  const map = { fuel: '⛽', food: '🍽️', hotel: '🏨', travel: '🚗', misc: '📦' };
  return map[cat] || '💰';
}
