import React, { useEffect, useState } from 'react';
import ManagerLayout from '../../components/layout/ManagerLayout';
import { managerAPI } from '../../services/api.service';
import toast from 'react-hot-toast';
import { Users, Receipt, Calendar, Activity, CheckCircle, Clock } from 'lucide-react';

export default function ManagerDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data } = await managerAPI.getDashboard();
      setStats(data.stats);
    } catch {
      toast.error('Failed to load dashboard stats');
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ icon: Icon, title, value, color, delay }) => (
    <div className={`glass-card p-6 border-l-4 border-${color}-500 animate-fade-in`} style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl bg-${color}-500/10 flex items-center justify-center`}>
          <Icon className={`w-6 h-6 text-${color}-500`} />
        </div>
      </div>
      <p className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-widest">{title}</p>
      <p className="text-[var(--text-main)] text-3xl font-black mt-1">{loading ? '...' : value}</p>
    </div>
  );

  return (
    <ManagerLayout>
      <div className="p-4 lg:p-6 space-y-6 max-w-[1600px] mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-[var(--text-main)] text-2xl font-black tracking-tight">Team Overview</h1>
            <p className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-widest mt-1">Real-time statistics of your assigned team</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Users} title="Total Team Members" value={stats?.totalEmployees || 0} color="blue" delay={0} />
          <StatCard icon={Activity} title="Active Now" value={stats?.activeEmployees || 0} color="emerald" delay={100} />
          <StatCard icon={CheckCircle} title="Present Today" value={stats?.todayAttendance || 0} color="primary" delay={200} />
          <StatCard icon={Clock} title="Tracking Location" value={stats?.trackingNow || 0} color="violet" delay={300} />
          <StatCard icon={Receipt} title="Pending Expenses" value={stats?.pendingExpenses || 0} color="amber" delay={400} />
        </div>

        <div className="mt-8 glass-card p-6 text-center text-[var(--text-muted)]">
          <p>More detailed reports and team lists are available in the navigation menu.</p>
        </div>
      </div>
    </ManagerLayout>
  );
}
