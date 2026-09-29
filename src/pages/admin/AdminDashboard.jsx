import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TrackProLayout from '../../components/layout/TrackProLayout';
import { useAuth } from '../../contexts/AuthContext';
import {
  Users,
  UserCheck,
  CalendarCheck,
  UserX,
  Wifi,
  MapPin,
  TrendingUp,
  Calendar,
  Building2,
  ChevronDown,
  ArrowRight,
  MoreVertical,
  CheckCircle2,
  Clock,
  Briefcase,
  Plus,
  Compass,
  ClipboardList,
  Receipt,
  BarChart3,
  Loader2,
  Sparkles,
  CreditCard,
  AlertTriangle,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { API } from '../../services/api.service';
import Avatar from '../../components/shared/Avatar';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
  const { user, organization } = useAuth();
  const navigate = useNavigate();

  const userRole = user?.role ? user.role.toUpperCase() : 'EMPLOYEE';
  const isSuperAdmin = userRole === 'SUPER_ADMIN' || userRole === 'SUPERADMIN';
  const isOrgAdmin = userRole === 'ORG_ADMIN' || userRole === 'ADMIN';
  const isPlanActive = isSuperAdmin || (
    organization?.status === 'active' &&
    Boolean(organization?.plan?.expiresAt) &&
    new Date(organization.plan.expiresAt) > new Date()
  );

  useEffect(() => {
    if (isSuperAdmin) {
      navigate('/super-admin', { replace: true });
    }
  }, [isSuperAdmin, navigate]);

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEmployees: 0,
    totalManagers: 0,
    presentToday: 0,
    absentToday: 0,
    currentlyOnline: 0,
    currentlyTracking: 0,
    totalKm: 0,
  });

  const [attendanceData, setAttendanceData] = useState([]);
  const [deptData, setDeptData] = useState([]);
  const [recentEmployees, setRecentEmployees] = useState([]);
  const [upcomingLeaves, setUpcomingLeaves] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [liveLocations, setLiveLocations] = useState([]);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        const res = await API.get('/admin/dashboard');
        if (res.data?.success) {
          const {
            stats: dbStats,
            attendanceOverview,
            departmentWise,
            recentEmployees: dbRecent,
            upcomingLeaves: dbLeaves,
            liveLocations: dbLive,
            recentActivities: dbAct,
          } = res.data;

          if (dbStats) setStats(dbStats);
          if (attendanceOverview) setAttendanceData(attendanceOverview);
          if (departmentWise) setDeptData(departmentWise);
          if (dbRecent && dbRecent.length > 0) {
            const mappedRecent = dbRecent.map((e) => ({
              id: e._id,
              name: e.name,
              avatar: e.avatar,
              empId: e.employeeId || 'EMP-' + e._id.slice(-6).toUpperCase(),
              dept: e.department || 'Field Services',
              manager: e.manager?.name || e.managerName || 'Admin Assigned',
              status: e.isTracking ? 'Tracking' : e.isOnline ? 'Online' : 'Offline',
              isTracking: e.isTracking,
              lastActive: e.lastSeen
                ? new Date(e.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'Recently',
            }));
            setRecentEmployees(mappedRecent);
          }
          if (dbLeaves) setUpcomingLeaves(dbLeaves);
          if (dbLive) setLiveLocations(dbLive);
          if (dbAct) setRecentActivities(dbAct);

        }
      } catch (e) {
        console.warn('Dashboard fetch error:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  return (
    <TrackProLayout>
      <div className="space-y-6">
        {/* Top Welcome & Context Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Welcome back, <span className="font-semibold text-slate-800">{user?.name || 'Administrator'}</span>! Real-time telemetry and team performance.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 shadow-xs">
              <Building2 className="w-4 h-4 text-blue-600" />
              <span>{organization?.name || user?.name || 'KISAN CHOICE'}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </div>

            <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 shadow-xs">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span>
                {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          </div>
        </div>



        {/* 6 TrackPro KPI Cards (Real DB Analytics) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* Total Employees */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold mb-3">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Total Employees</p>
              <h3 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">{stats.totalEmployees}</h3>
              <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-0.5 mt-1">
                <TrendingUp className="w-3 h-3" /> Live from DB
              </span>
            </div>
          </div>

          {/* Total Managers */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold mb-3">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Total Managers</p>
              <h3 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">{stats.totalManagers}</h3>
              <span className="text-[11px] font-semibold text-indigo-600 flex items-center gap-0.5 mt-1">
                <CheckCircle2 className="w-3 h-3" /> Active Leaders
              </span>
            </div>
          </div>

          {/* Present Today */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold mb-3">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Present Today</p>
              <h3 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">{stats.presentToday}</h3>
              <span className="text-[11px] font-medium text-slate-500 mt-1 block">
                {stats.totalEmployees > 0 ? ((stats.presentToday / stats.totalEmployees) * 100).toFixed(0) : 0}% of total
              </span>
            </div>
          </div>

          {/* Absent Today */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold mb-3">
              <UserX className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Absent Today</p>
              <h3 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">{stats.absentToday}</h3>
              <span className="text-[11px] font-medium text-slate-500 mt-1 block">
                {stats.totalEmployees > 0 ? ((stats.absentToday / stats.totalEmployees) * 100).toFixed(0) : 0}% of total
              </span>
            </div>
          </div>

          {/* Currently Online */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold mb-3">
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Currently Online</p>
              <h3 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">{stats.currentlyOnline}</h3>
              <span className="text-[11px] font-medium text-purple-600 mt-1 block font-semibold">Active Session</span>
            </div>
          </div>

          {/* Real Tracked Distance (KM) */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="w-9 h-9 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center font-bold mb-3">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Tracked Distance</p>
              <h3 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
                {stats.totalKm ? stats.totalKm.toLocaleString() : '0'} <span className="text-sm font-semibold text-slate-500">km</span>
              </h3>
              <span className="text-[11px] font-medium text-cyan-600 mt-1 block font-semibold">
                {stats.currentlyTracking} active GPS
              </span>
            </div>
          </div>
        </div>

        {/* Middle Section: Attendance Overview + Live Tracking Mini Map + Recent Activities */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Attendance Overview Bar Chart (5 cols) */}
          <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Attendance Overview</h3>
                <div className="flex items-center gap-3 text-[11px] font-medium text-slate-500 mt-1">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Present</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500"></span> Absent</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Late</span>
                </div>
              </div>

              <select className="text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none">
                <option>Last 7 Days</option>
              </select>
            </div>

            <div className="h-56 w-full">
              {attendanceData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={attendanceData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        borderRadius: '10px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="Present" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Absent" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Late" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  {loading ? 'Loading attendance trend...' : 'No attendance data recorded in the last 7 days.'}
                </div>
              )}
            </div>
          </div>

          {/* Live Tracking Mini Map (4 cols) */}
          <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900">Live Tracking</h3>
              <button
                onClick={() => navigate('/admin/live-map')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                View Full Map <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div
              onClick={() => navigate('/admin/live-map')}
              className="relative h-56 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 cursor-pointer group"
            >
              {/* Map Canvas Background */}
              <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px] bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition shadow-sm">
                    <Compass className="w-6 h-6 animate-pulse" />
                  </div>
                  <span className="text-xs font-bold text-slate-700 block">
                    {liveLocations.length > 0 ? `${liveLocations.length} Active Tracking Sessions` : 'Telemetry & Live GPS Ready'}
                  </span>
                  <span className="text-[11px] text-slate-400">Click to view real-time locations</span>
                </div>
              </div>

              {/* Real Active Employee Badge if any */}
              {recentEmployees.length > 0 && (
                <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm p-2.5 rounded-xl border border-slate-200 shadow-md text-xs z-10 max-w-[210px]">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center">
                      {recentEmployees[0].name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 truncate">{recentEmployees[0].name}</div>
                      <div className="text-[10px] text-slate-500">{recentEmployees[0].dept}</div>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1.5 pt-1.5 border-t border-slate-100 flex items-center justify-between">
                    <span>Status: <span className="font-semibold text-emerald-600">{recentEmployees[0].status}</span></span>
                    <span>{recentEmployees[0].lastActive}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Recent Activities (3 cols) */}
          <div className="lg:col-span-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900">Recent Activities</h3>
              <button onClick={() => navigate('/admin/tracking-history')} className="text-xs font-semibold text-blue-600 hover:text-blue-700">View History</button>
            </div>

            <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
              {recentActivities.length > 0 ? (
                recentActivities.map((act) => (
                  <div key={act._id} className="flex items-start gap-3 text-xs">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5 font-bold text-[11px]">
                      {act.employee?.name ? act.employee.name.slice(0, 1).toUpperCase() : 'A'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-800 truncate">
                        <span className="font-bold text-slate-900">{act.employee?.name || 'User'}</span> {act.description || act.action}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {act.employee?.department || 'Field Services'}
                      </p>
                    </div>
                  </div>
                ))
              ) : recentEmployees.length > 0 ? (
                recentEmployees.slice(0, 4).map((emp) => (
                  <div key={emp.id} className="flex items-start gap-3 text-xs">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5 font-bold text-[11px]">
                      {emp.name.slice(0, 1)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-800 truncate">
                        <span className="font-bold text-slate-900">{emp.name}</span> active on field
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {emp.lastActive} • {emp.dept}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-xs text-slate-400">
                  No recent activities recorded yet.
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Lower Row: Team Performance + Department Donut + Upcoming Leave */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Team Performance Gauges (5 cols) */}
          <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900">Team Performance</h3>
              <span onClick={() => navigate('/admin/reports')} className="text-xs font-semibold text-blue-600 cursor-pointer">View Report ▾</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100 flex flex-col items-center">
                <div className="w-14 h-14 rounded-full border-4 border-emerald-500 flex items-center justify-center text-sm font-bold text-slate-900 mb-2">
                  100%
                </div>
                <span className="text-[11px] font-bold text-slate-700 leading-tight">GPS Accuracy</span>
                <span className="text-[10px] text-emerald-600 font-semibold mt-1">High Precision</span>
              </div>

              <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100 flex flex-col items-center">
                <div className="w-14 h-14 rounded-full border-4 border-blue-500 flex items-center justify-center text-sm font-bold text-slate-900 mb-2">
                  {stats.totalEmployees > 0 ? Math.round((stats.presentToday / stats.totalEmployees) * 100) : 0}%
                </div>
                <span className="text-[11px] font-bold text-slate-700 leading-tight">Attendance</span>
                <span className="text-[10px] text-blue-600 font-semibold mt-1">Today</span>
              </div>

              <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100 flex flex-col items-center">
                <div className="w-14 h-14 rounded-full border-4 border-teal-500 flex items-center justify-center text-sm font-bold text-slate-900 mb-2">
                  {stats.totalEmployees}
                </div>
                <span className="text-[11px] font-bold text-slate-700 leading-tight">Field Force</span>
                <span className="text-[10px] text-teal-600 font-semibold mt-1">Active Accounts</span>
              </div>

              <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100 flex flex-col items-center">
                <div className="w-14 h-14 rounded-full border-4 border-indigo-500 flex items-center justify-center text-sm font-bold text-slate-900 mb-2">
                  {stats.totalManagers}
                </div>
                <span className="text-[11px] font-bold text-slate-700 leading-tight">Managers</span>
                <span className="text-[10px] text-indigo-600 font-semibold mt-1">Assigned</span>
              </div>
            </div>
          </div>

          {/* Department Wise Donut (4 cols) */}
          <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-slate-900">Department Wise Employees</h3>
              <button onClick={() => navigate('/admin/departments')} className="text-xs font-semibold text-blue-600">View All</button>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-36 h-36 relative flex-shrink-0">
                {deptData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={deptData} innerRadius={42} outerRadius={60} paddingAngle={4} dataKey="value">
                          {deptData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-base font-bold text-slate-900">{stats.totalEmployees}</span>
                      <span className="text-[10px] text-slate-500 font-medium">Total</span>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                    No Departments
                  </div>
                )}
              </div>

              <div className="flex-1 grid grid-cols-1 gap-y-1.5 text-xs">
                {deptData.map((d) => (
                  <div key={d.name} className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-600 truncate">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }}></span>
                      <span className="truncate">{d.name}</span>
                    </span>
                    <span className="font-bold text-slate-900">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Upcoming Leave Requests (3 cols) */}
          <div className="lg:col-span-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900">Upcoming Leave Requests</h3>
              <button onClick={() => navigate('/admin/leaves')} className="text-xs font-semibold text-blue-600">View All</button>
            </div>

            <div className="space-y-3 text-xs max-h-56 overflow-y-auto pr-1">
              {upcomingLeaves.length > 0 ? (
                upcomingLeaves.map((l) => (
                  <div key={l._id} className="flex items-center justify-between p-2 rounded-xl bg-slate-50">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar
                        src={l.employee?.avatar}
                        name={l.employee?.name}
                        size="xs"
                      />
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 truncate">{l.employee?.name || 'Employee'}</div>
                        <div className="text-[10px] text-slate-500 truncate capitalize">
                          {l.type} Leave • {new Date(l.startDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize flex-shrink-0 ${
                      l.status === 'approved'
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                        : l.status === 'rejected'
                        ? 'bg-rose-50 text-rose-600 border-rose-200'
                        : 'bg-amber-50 text-amber-600 border-amber-200'
                    }`}>
                      {l.status}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-xs text-slate-400">
                  No upcoming leaves submitted.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Section: Recent Employees Table (8 cols) + Quick Actions (4 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Recent Employees Table (8 cols) */}
          <div className="lg:col-span-8 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900">Recent Employees</h3>
              <button onClick={() => navigate('/admin/employees')} className="text-xs font-semibold text-blue-600">View All</button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase">
                    <th className="py-2.5 px-3">Name</th>
                    <th className="py-2.5 px-3">Employee ID</th>
                    <th className="py-2.5 px-3">Department</th>
                    <th className="py-2.5 px-3">Manager</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Last Active</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {recentEmployees.length > 0 ? (
                    recentEmployees.map((emp) => (
                      <tr key={emp.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-3 font-semibold text-slate-900 flex items-center gap-2.5">
                          <Avatar
                            src={emp.avatar}
                            name={emp.name}
                            size="xs"
                            status={emp.status === 'Online'}
                          />
                          <span>{emp.name}</span>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-500">{emp.empId}</td>
                        <td className="py-3 px-3">{emp.dept}</td>
                        <td className="py-3 px-3">{emp.manager}</td>
                        <td className="py-3 px-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            emp.status === 'Online' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${emp.status === 'Online' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                            {emp.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-500">{emp.lastActive}</td>
                        <td className="py-3 px-3 text-right">
                          <button onClick={() => navigate('/admin/employees')} className="text-slate-400 hover:text-slate-600 p-1">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="py-8 text-center text-xs text-slate-400">
                        {loading ? 'Loading team records from database...' : 'No employees found.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Actions (4 cols) */}
          <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-3">Quick Actions</h3>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  onClick={() => {
                    if (!isPlanActive) {
                      toast.error('❌ Subscription Plan Not Active! Billing enable first to add employees.', { id: 'dash-plan-check' });
                      navigate('/admin/billing');
                      return;
                    }
                    navigate('/admin/employees');
                  }}
                  className="p-3 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-xl font-semibold flex items-center gap-2 border border-slate-100 transition active:scale-95"
                >
                  <Users className="w-4 h-4 text-blue-600" /> Add Employee
                </button>

                <button
                  onClick={() => navigate('/admin/attendance')}
                  className="p-3 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-xl font-semibold flex items-center gap-2 border border-slate-100 transition"
                >
                  <CalendarCheck className="w-4 h-4 text-emerald-600" /> Attendance
                </button>

                <button
                  onClick={() => navigate('/admin/managers')}
                  className="p-3 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-xl font-semibold flex items-center gap-2 border border-slate-100 transition"
                >
                  <UserCheck className="w-4 h-4 text-indigo-600" /> Managers
                </button>

                <button
                  onClick={() => navigate('/admin/tasks')}
                  className="p-3 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-xl font-semibold flex items-center gap-2 border border-slate-100 transition"
                >
                  <ClipboardList className="w-4 h-4 text-purple-600" /> Tasks
                </button>

                <button
                  onClick={() => navigate('/admin/managers')}
                  className="p-3 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-xl font-semibold flex items-center gap-2 border border-slate-100 transition"
                >
                  <UserCheck className="w-4 h-4 text-cyan-600" /> Assign Team
                </button>

                <button
                  onClick={() => navigate('/admin/expenses')}
                  className="p-3 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-xl font-semibold flex items-center gap-2 border border-slate-100 transition"
                >
                  <Receipt className="w-4 h-4 text-amber-600" /> Expenses
                </button>

                <button
                  onClick={() => navigate('/admin/reports')}
                  className="p-3 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-xl font-semibold flex items-center gap-2 border border-slate-100 transition"
                >
                  <BarChart3 className="w-4 h-4 text-blue-600" /> Reports
                </button>

                <button
                  onClick={() => navigate('/admin/leaves')}
                  className="p-3 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-xl font-semibold flex items-center gap-2 border border-slate-100 transition"
                >
                  <Calendar className="w-4 h-4 text-rose-600" /> Leaves
                </button>
              </div>
            </div>

            {/* Bottom Banner Card */}
            <div className="mt-4 p-3.5 bg-blue-50/70 border border-blue-200/60 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span className="text-slate-700 font-medium">Keep your team productive with live tracking.</span>
              </div>
              <button
                onClick={() => navigate('/admin/live-map')}
                className="text-blue-600 font-bold hover:underline flex-shrink-0 text-[11px]"
              >
                Go to Live Tracking →
              </button>
            </div>
          </div>
        </div>
      </div>
    </TrackProLayout>
  );
}
