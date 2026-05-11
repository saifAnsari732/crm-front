import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import EmployeeLayout from '../../components/layout/EmployeeLayout';
import { adminAPI, attendanceAPI, meetingAPI, expenseAPI, trackingAPI } from '../../services/api.service';
import {
  MapPin, Users, Receipt, TrendingUp, Clock, ChevronRight,
  Navigation, CheckCircle, AlertCircle, Calendar, Zap
} from 'lucide-react';

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
    { label: 'Start Tracking', icon: MapPin, color: 'bg-primary-600 hover:bg-primary-500 shadow-glow', to: '/tracking' },
    { label: 'Add Meeting', icon: Users, color: 'bg-violet-600 hover:bg-violet-500', to: '/meetings' },
    { label: 'Add Expense', icon: Receipt, color: 'bg-amber-600 hover:bg-amber-500', to: '/expenses' },
  ];

  return (
    <EmployeeLayout>
      <div className="p-4 lg:p-6 space-y-6 max-w-5xl mx-auto">
        {/* Welcome card */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600/30 via-primary-700/20 to-violet-600/20 border border-primary-500/30 p-6">
          <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-primary-400/10 blur-2xl -translate-y-12 translate-x-12" />
          <div className="relative">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-primary-300 text-sm font-semibold mb-1">
                  {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                <h2 className="text-white text-2xl font-bold mb-1">
                  Hey, {user?.name?.split(' ')[0]}! 👋
                </h2>
                <p className="text-white/50 text-sm">
                  {user?.department} • {user?.designation || 'Field Executive'}
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-xl flex-shrink-0">
                {user?.avatar ? <img src={user.avatar} alt="" className="w-full h-full rounded-2xl object-cover" /> : '👤'}
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${stats.attended ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
              <span className="text-white/60 text-xs">{stats.attended ? 'Checked in today' : 'Not checked in'}</span>
              <span className="text-white/20 mx-1">•</span>
              <span className="text-white/60 text-xs">ID: {user?.employeeId}</span>
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {statCards.map((card, i) => {
            const Icon = card.icon;
            return (
              <div key={i} className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${card.color} border ${card.border} p-4`}
                style={{ animationDelay: `${i * 0.1}s` }}>
                <div className={`w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center mb-3`}>
                  <Icon className={`w-4 h-4 ${card.iconColor}`} />
                </div>
                <p className="text-white text-xl font-bold">{loading ? '—' : card.value}</p>
                <p className="text-white/50 text-xs mt-0.5">{card.label}</p>
              </div>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div>
          <h3 className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-3">Quick Actions</h3>
          <div className="grid grid-cols-3 gap-3">
            {quickActions.map((a, i) => {
              const Icon = a.icon;
              return (
                <button key={i} onClick={() => navigate(a.to)}
                  className={`${a.color} text-white rounded-2xl p-4 flex flex-col items-center gap-2 transition-all duration-200 active:scale-95`}>
                  <Icon className="w-6 h-6" />
                  <span className="text-xs font-semibold text-center leading-tight">{a.label}</span>
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
