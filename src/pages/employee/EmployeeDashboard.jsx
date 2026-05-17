import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import EmployeeLayout from '../../components/layout/EmployeeLayout';
import { adminAPI, attendanceAPI, authAPI, meetingAPI, expenseAPI, trackingAPI, employeeAPI, uploadAPI } from '../../services/api.service';
import {
  MapPin, Users, Receipt, TrendingUp, Clock, ChevronRight,
  Navigation, CheckCircle, AlertCircle, Calendar, Zap, ClipboardList, Locate, Upload
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ meetings: 0, expenses: 0, distance: 0, attended: false, totalDistanceAll: 0 });
  const [loading, setLoading] = useState(true);
  const [recentMeetings, setRecentMeetings] = useState([]);
  const [recentExpenses, setRecentExpenses] = useState([]);
  const [employeeDetails, setEmployeeDetails] = useState(null);
  const [daReceiptUrl, setDaReceiptUrl] = useState('');
  const [daAmount, setDaAmount] = useState(0);
  const [daFile, setDaFile] = useState(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);


  const travelPay = employeeDetails ? +(stats.distance * (employeeDetails.TA || 2.5)).toFixed(2) : 0;
  const travelPayTotal = employeeDetails ? +((stats.totalDistanceAll || 0) * (employeeDetails.TA || 2.5)).toFixed(2) : 0;

  const statCardsFinal = useMemo(() => {
    const base = [
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
        label: 'Travel Rate', value: `₹${(employeeDetails?.TA || 2.5).toFixed(2)} / km`,
        icon: Navigation, color: 'from-blue-500/20 to-blue-600/5', iconColor: 'text-blue-400', border: 'border-blue-500/20'
      },
      {
        label: 'Total Distance', value: `${(stats.totalDistanceAll || 0).toFixed(1)} km`,
        icon: Navigation, color: 'from-blue-500/20 to-blue-600/5', iconColor: 'text-blue-400', border: 'border-blue-500/20'
      },
      {
        label: 'Daily Allowance', value: `₹${(employeeDetails?.DA || 0).toLocaleString()}`,
        icon: Calendar, color: 'from-emerald-500/20 to-emerald-600/5', iconColor: 'text-emerald-400', border: 'border-emerald-500/20'
      },
      {
        label: 'Status', value: stats.attended ? 'Present' : 'Absent',
        icon: CheckCircle, color: stats.attended ? 'from-emerald-500/20 to-emerald-600/5' : 'from-red-500/20 to-red-600/5',
        iconColor: stats.attended ? 'text-emerald-400' : 'text-red-400',
        border: stats.attended ? 'border-emerald-500/20' : 'border-red-500/20'
      }
    ];

    if (employeeDetails) {

      base.push({
        label: 'Travel Pay (All)', value: `₹${travelPayTotal.toLocaleString()}`,
        icon: Receipt, color: 'from-amber-500/20 to-amber-600/5', iconColor: 'text-amber-400', border: 'border-amber-500/20'
      });
    }

    return base;
  }, [stats, employeeDetails, travelPay, travelPayTotal]);

  const quickActions = useMemo(() => [
    { label: 'Start Tracking', icon: MapPin, color: 'bg-primary-600 hover:bg-primary-500 shadow-glow shadow-primary-600/30', to: '/tracking' },
    { label: 'My Tasks', icon: ClipboardList, color: 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/20', to: '/tasks' },
    { label: 'Apply Leave', icon: Calendar, color: 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/20', to: '/leaves' },
    { label: 'Add Meeting', icon: Users, color: 'bg-violet-600 hover:bg-violet-500 shadow-lg shadow-violet-600/20', to: '/meetings' },
    { label: 'Add Expense', icon: Receipt, color: 'bg-amber-600 hover:bg-amber-500 shadow-lg shadow-amber-600/20', to: '/expenses' },
  ], []);

  const submitDa = async (file) => {
    const amountToAdd = Number(daAmount) || 0;

    // Validation rules:
    // - If user is uploading receipt (file provided), allow receipt upload flow.
    // - If user is NOT uploading receipt (DA-only), require a valid DA amount.

    if (!file) {
      if (!amountToAdd || amountToAdd <= 0) {
        toast.error('Enter a valid DA amount');
        return;
      }
    }

    // If no receipt file provided, just submit DA (receipt optional)
    if (!file) {
      try {
        setUploadingReceipt(true);
        const { data: resData } = await authAPI.updateProfile({ DA: amountToAdd });

        const updatedUser = resData?.user;
        if (updatedUser) {
          setEmployeeDetails(updatedUser);
          setDaReceiptUrl(updatedUser.daReceipt || '');
        setDaAmount(0);
        }

        toast.success('DA saved successfully (receipt not provided)');
      } catch (err) {
        console.error('DA submit error:', err?.response?.data || err);
        toast.error('DA submission failed');
      } finally {
        setUploadingReceipt(false);
      }
      return;
    }

    setUploadingReceipt(true);
    try {
      const formData = new FormData();
      formData.append('image', file);

      // 1) Upload receipt
      const { data } = await uploadAPI.uploadImage(formData);

      // 2) Save receipt + add DA total (server handles increment)
      const payload = {
        daReceipt: data.url,
        DA: amountToAdd,
      };

      const { data: resData } = await authAPI.updateProfile(payload);

      const updatedUser = resData?.user;
      if (updatedUser) {
        setEmployeeDetails(updatedUser);
        setDaReceiptUrl(updatedUser.daReceipt || '');
        setDaAmount(0);
      } else {
        // fallback (shouldn't happen if backend returns user)
        setDaReceiptUrl(data.url);
        setEmployeeDetails(prev => prev ? { ...prev, daReceipt: data.url, DA: (prev.DA || 0) + amountToAdd } : prev);
        setDaAmount(0);
      }

      toast.success('DA receipt saved successfully');
    } catch (err) {
      console.error('DA submit error:', err?.response?.data || err);
      toast.error('Receipt upload failed');
    } finally {
      setUploadingReceipt(false);
    }
  };

  const fetchData = useCallback(async () => {
    try {
      const [meetRes, expRes, attRes, trackRes, empRes] = await Promise.allSettled([
        meetingAPI.getMy({ limit: 3 }),
        expenseAPI.getMy({ limit: 3 }),
        attendanceAPI.getToday(),
        trackingAPI.getToday(),
        employeeAPI.getById(user._id),
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
      if (empRes.status === 'fulfilled') {
        const employee = empRes.value.data.employee || null;
        setEmployeeDetails(employee);
        setDaReceiptUrl(employee?.daReceipt || '');
        setDaAmount(0);
      }

      // Fetch aggregate report (total distance etc.)
      try {
        const { data: reportData } = await trackingAPI.getEmployeeReport(user._id);
        if (reportData?.stats?.totalDistance !== undefined) {
          setStats(s => ({ ...s, totalDistanceAll: reportData.stats.totalDistance }));
        }
      } catch (err) {
        // ignore report errors
        console.error('Failed to fetch employee report', err);
      }
    } finally {
      setLoading(false);
    }
  }, [user._id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
                onClick={() => navigate('/tracking')}
                className="px-4 py-2 rounded-2xl bg-[var(--bg-surface)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-color)] flex items-center gap-2 text-[var(--text-main)] transition-all active:scale-95"
              >
                <Locate className="w-3.5 h-3.5 text-primary-300" />
                <span className="text-[10px] font-black uppercase tracking-widest">Enable Location</span>
              </button>
              <span className="text-[var(--text-muted)] text-[10px] font-bold tracking-widest uppercase hidden md:inline">EMP ID: {user?.employeeId}</span>
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCardsFinal.map((card, i) => (
            <div key={i} className={`glass-card p-5 bg-gradient-to-br ${card.color} ${card.border} group relative overflow-hidden`}>
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                {/* <card.icon className="w-12 h-12" /> */}
              </div>
              <div className="relative">
                <p className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-wider mb-2">{card.label}</p>
                <p className="text-[var(--text-main)] text-2xl font-black">{loading ? '—' : card.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Travel summary and DA upload */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="glass-card p-6 border-[var(--border-color)] bg-[var(--bg-card)]">
            <p className="text-[var(--text-muted)] text-[10px] uppercase tracking-[0.2em] mb-4">Today’s distance</p>
            <p className="text-[var(--text-main)] text-5xl font-black tracking-tight">{stats.distance.toFixed(2)} km</p>
            <p className="text-[var(--text-muted)] text-sm mt-2">≈ {Math.round(stats.distance * 1000)} meters</p>
            <p className="text-[var(--text-muted)] text-[10px] mt-4 uppercase tracking-[0.25em]">Travel allowance</p>
            <p className="text-[var(--text-main)] text-lg font-black">₹{travelPay.toLocaleString()}</p>
          </div>

          <div className="glass-card p-6 border-[var(--border-color)] bg-[var(--bg-card)]">
            <p className="text-[var(--text-muted)] text-[10px] uppercase tracking-[0.2em] mb-4">Allowance details</p>
            <div className="space-y-4">
              <div>
                <p className="text-[var(--text-main)] text-sm font-black">Travel rate</p>
                <p className="text-[var(--text-muted)] text-xs mt-1">₹{(employeeDetails?.TA || 2.5).toFixed(2)} / km</p>
              </div>
              <div>
                <p className="text-[var(--text-main)] text-sm font-black">Daily allowance</p>
                <p className="text-[var(--text-muted)] text-xs mt-1">₹{(employeeDetails?.DA || 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[var(--text-main)] text-sm font-black">Total salary</p>
                <p className="text-[var(--text-muted)] text-xs mt-1">₹{((employeeDetails?.salary || 0) + travelPayTotal + (employeeDetails?.DA || 0)).toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="glass-card p-6 border-[var(--border-color)] bg-[var(--bg-card)]">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <p className="text-[var(--text-muted)] text-[10px] uppercase tracking-[0.2em]">Daily Allowance Claim</p>
                <p className="text-[var(--text-main)] text-sm font-black mt-2">Submit DA (Receipt optional)</p>
              </div>
              <Upload className="w-5 h-5 text-primary-400" />
            </div>
            
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">DA Amount (₹)</label>
            <input
              type="number"
              value={daAmount}
              onChange={e => setDaAmount(parseInt(e.target.value) || 0)}
              placeholder="Enter DA amount"
              className="w-full px-4 py-2 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)] text-[var(--text-main)] text-sm focus:outline-none focus:border-primary-500 mb-4"
            />
            
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Receipt image</label>
            <input
              id="da-receipt-input"
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                setDaFile(f || null);
              }}
              className="block w-full text-sm text-[var(--text-main)] file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-600 file:text-white hover:file:bg-primary-500"
            />
            <button
              type="button"
              disabled={uploadingReceipt}
              onClick={() => submitDa(daFile && daFile.size > 0 ? daFile : null)}
              className="btn-primary mt-3 w-full flex items-center justify-center gap-2 py-2.5 px-5"
            >
              {uploadingReceipt ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Submit DA'}
            </button>
            {uploadingReceipt && <p className="text-[var(--text-muted)] text-xs mt-2">Uploading receipt…</p>}
            {daReceiptUrl ? (
              <div className="mt-4 p-4 rounded-2xl bg-[var(--bg-main)] border border-[var(--border-color)] text-[var(--text-main)] text-xs">
                <p className="font-bold text-primary-400 mb-1">✓ Submitted: ₹{daAmount.toLocaleString()}</p>
                Receipt uploaded. <a href={daReceiptUrl} target="_blank" rel="noreferrer" className="text-primary-400 underline">View</a>
              </div>
            ) : (
              <p className="text-[var(--text-muted)] text-xs mt-3">Enter DA amount and upload receipt image to claim.</p>
            )}
          </div>
        </div>

        {/* Quick Actions (Mobile-Friendly Horizontal Scroll) */}
        <div>
          <h3 className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.2em] mb-4 ml-1">Quick Operations</h3>
          <div className="grid grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-6">
            {quickActions.map((a, i) => {
              const Icon = a.icon;
              return (
                <button key={a.label} onClick={() => navigate(a.to)}
                  className={`${a.color} text-white rounded-[1.5rem] p-4 lg:p-5 flex flex-col items-center gap-2 lg:gap-3 transition-all duration-300 active:scale-95 w-full hover:-translate-y-1 shadow-lg shadow-black/10`}>
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
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[var(--text-main)] font-black text-lg tracking-tight">Recent Meetings</h3>
            <button onClick={() => navigate('/meetings')} className="text-primary-500 text-xs font-bold flex items-center gap-1 hover:gap-2 transition-all">
              View All <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map(i => <div key={i} className="h-16 rounded-xl bg-[var(--bg-surface)] animate-pulse" />)}
            </div>
          ) : recentMeetings.length === 0 ? (
            <div className="glass-card p-8 text-center bg-[var(--bg-surface)]">
              <Users className="w-10 h-10 text-[var(--text-muted)] opacity-20 mx-auto mb-3" />
              <p className="text-[var(--text-muted)] text-sm">No meetings logged today</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentMeetings.map(m => (
                <div key={m._id} className="glass-card p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5 text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[var(--text-main)] font-semibold text-sm truncate">{m.clientName}</p>
                    <p className="text-[var(--text-muted)] text-xs truncate">{m.companyName} • {new Date(m.date).toLocaleDateString('en-IN')}</p>
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
            <h3 className="text-[var(--text-main)] font-semibold text-sm">Recent Expenses</h3>
            <button onClick={() => navigate('/expenses')} className="text-primary-400 text-xs flex items-center gap-1 hover:text-primary-300">
              View all <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          {loading ? (
            <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-16 rounded-xl bg-[var(--bg-surface)] animate-pulse" />)}</div>
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
                    <p className="text-[var(--text-main)] font-semibold text-sm capitalize">{exp.category}</p>
                    <p className="text-[var(--text-muted)] text-xs">{new Date(exp.date).toLocaleDateString('en-IN')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[var(--text-main)] font-bold text-sm">₹{exp.amount.toLocaleString()}</p>
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
      <p className="text-[var(--text-muted)] text-sm">{text}</p>
    </div>
  );
}

function categoryEmoji(cat) {
  const map = { fuel: '⛽', food: '🍽️', hotel: '🏨', travel: '🚗', misc: '📦' };
  return map[cat] || '💰';
}
