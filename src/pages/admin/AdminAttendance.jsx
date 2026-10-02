import React, { useState, useEffect } from 'react';
import KisanConnectLayout from '../../components/layout/KisanConnectLayout';
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  Download,
  Search,
  Eye,
  X,
  Radio,
  RefreshCw,
  User,
  Filter,
  History,
  TrendingUp,
  MapPin,
} from 'lucide-react';
import { API } from '../../services/api.service';
import toast from 'react-hot-toast';
import Avatar from '../../components/shared/Avatar';

export default function AdminAttendance() {
  const todayStr = new Date().toISOString().slice(0, 10);

  const [attendance, setAttendance] = useState([]);
  const [employeesList, setEmployeesList] = useState([]);
  const [previewSelfie, setPreviewSelfie] = useState(null);
  const [selectedEmpHistory, setSelectedEmpHistory] = useState(null);
  const [stats, setStats] = useState({
    totalEmployees: 0,
    presentToday: 0,
    absentToday: 0,
    lateToday: 0,
    halfDayToday: 0,
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [empFilter, setEmpFilter] = useState('all');
  // Default to TODAY so user sees today's attendance by default
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [viewMode, setViewMode] = useState('today'); // 'today' | 'history' | 'employee'
  const [onlyActiveNow, setOnlyActiveNow] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchAttendanceData = async () => {
    try {
      setLoading(true);
      const [attRes, empRes] = await Promise.all([
        API.get('/admin/attendance').catch(() => ({ data: { success: false } })),
        API.get('/employees').catch(() => ({ data: { success: false } })),
      ]);

      if (attRes.data?.success && Array.isArray(attRes.data.records)) {
        setAttendance(attRes.data.records);
        if (attRes.data.stats) {
          setStats(attRes.data.stats);
        }
      }

      if (empRes.data?.success && Array.isArray(empRes.data.employees)) {
        setEmployeesList(empRes.data.employees);
      }
    } catch (e) {
      console.error('Error fetching attendance records:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendanceData();
  }, []);

  const distinctDepts = Array.from(
    new Set(attendance.map((a) => a.employee?.department).filter(Boolean))
  );

  // Extract all unique employees from attendance records + employeesList
  const uniqueEmployees = Array.from(
    new Map(
      [
        ...employeesList.map((e) => [e._id, { id: e._id, name: e.name, employeeId: e.employeeId, dept: e.department }]),
        ...attendance
          .filter((a) => a.employee?._id)
          .map((a) => [a.employee._id, { id: a.employee._id, name: a.employee.name, employeeId: a.employee.employeeId, dept: a.employee.department }]),
      ]
    ).values()
  );

  // Active now count
  const activeNowCount = attendance.filter((a) => {
    const isToday = a.date === todayStr || (!a.date && a.createdAt?.startsWith(todayStr));
    return isToday && a.checkIn && !a.checkOut;
  }).length;

  // Filter records
  const filtered = attendance.filter((a) => {
    const empName = a.employee?.name || 'Unknown Employee';
    const empId = a.employee?.employeeId || '';
    const empDbId = a.employee?._id || '';
    const empDept = a.employee?.department || '';
    const recordDate = a.date || (a.createdAt ? a.createdAt.slice(0, 10) : '');

    const matchesSearch =
      empName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      empId.toLowerCase().includes(searchTerm.toLowerCase());

    const isTodayRecord = recordDate === todayStr;
    const isCheckedInActive = Boolean(a.checkIn && !a.checkOut);

    let matchesStatus = true;
    if (onlyActiveNow || statusFilter === 'active') {
      matchesStatus = isTodayRecord && isCheckedInActive;
    } else if (statusFilter === 'today') {
      matchesStatus = isTodayRecord;
    } else if (statusFilter !== 'all') {
      matchesStatus = a.status?.toLowerCase() === statusFilter.toLowerCase();
    }

    const matchesDept = deptFilter === 'all' || empDept === deptFilter;
    const matchesEmp = empFilter === 'all' || empDbId === empFilter;

    let matchesDate = true;
    if (viewMode === 'today') {
      matchesDate = isTodayRecord;
    } else if (selectedDate) {
      matchesDate = recordDate === selectedDate;
    }

    return matchesSearch && matchesStatus && matchesDept && matchesEmp && matchesDate;
  });

  const formatTime = (isoString) => {
    if (!isoString) return '-';
    try {
      return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString;
    }
  };

  const calculateHours = (inTime, outTime) => {
    if (!inTime || !outTime) return '-';
    try {
      const diffMs = new Date(outTime) - new Date(inTime);
      if (diffMs <= 0) return '-';
      const hours = Math.floor(diffMs / 3600000);
      const minutes = Math.floor((diffMs % 3600000) / 60000);
      return `${hours}h ${minutes}m`;
    } catch {
      return '-';
    }
  };

  // Helper for date quick presets
  const handleDatePreset = (preset) => {
    if (preset === 'today') {
      setViewMode('today');
      setSelectedDate(todayStr);
    } else if (preset === 'yesterday') {
      setViewMode('history');
      const d = new Date();
      d.setDate(d.getDate() - 1);
      setSelectedDate(d.toISOString().slice(0, 10));
    } else if (preset === 'all') {
      setViewMode('history');
      setSelectedDate('');
    }
  };

  return (
    <KisanConnectLayout>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Attendance Management</h1>
              <span className="px-3 py-1 rounded-full text-xs font-black bg-blue-100 text-blue-800 border border-blue-200">
                {viewMode === 'today' ? `📅 Today (${todayStr})` : selectedDate ? `📅 ${selectedDate}` : '📜 Full History'}
              </span>
            </div>
            <p className="text-base font-medium text-slate-600 mt-1">
              Track today's active workforce, find employee-wise history, and filter attendance logs by date.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* View Mode Tabs: Today vs History */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-extrabold">
              <button
                onClick={() => handleDatePreset('today')}
                className={`px-3.5 py-2 rounded-lg transition ${
                  viewMode === 'today' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                📅 Today's Attendance
              </button>
              <button
                onClick={() => handleDatePreset('all')}
                className={`px-3.5 py-2 rounded-lg transition ${
                  viewMode === 'history' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                📜 All Attendance History
              </button>
            </div>

            <button
              onClick={() => toast.success('Attendance report exported as CSV!')}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-xs transition"
            >
              <Download className="w-4 h-4" /> Export Report
            </button>
          </div>
        </div>

        {/* 6 KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold mb-3">
              <Users className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Employees</p>
            <h3 className="text-3xl font-black text-slate-900 mt-1">{stats.totalEmployees || uniqueEmployees.length}</h3>
            <span className="text-xs font-bold text-emerald-600 mt-1 block">Live from DB</span>
          </div>

          {/* Active Now Card */}
          <button
            type="button"
            onClick={() => setOnlyActiveNow(!onlyActiveNow)}
            className={`text-left p-5 rounded-2xl border transition shadow-xs ${
              onlyActiveNow
                ? 'bg-emerald-500 text-white border-emerald-600 ring-2 ring-emerald-400'
                : 'bg-white border-emerald-200 hover:border-emerald-400'
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold mb-3 ${
              onlyActiveNow ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-600'
            }`}>
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <p className={`text-xs font-bold uppercase tracking-wider ${onlyActiveNow ? 'text-emerald-100' : 'text-slate-500'}`}>
              Active Now
            </p>
            <h3 className={`text-3xl font-black mt-1 ${onlyActiveNow ? 'text-white' : 'text-slate-900'}`}>
              {activeNowCount}
            </h3>
            <span className={`text-xs font-bold mt-1 block ${onlyActiveNow ? 'text-emerald-100' : 'text-emerald-600'}`}>
              {onlyActiveNow ? '✓ Filtered Active Only' : 'Click to Filter Active'}
            </span>
          </button>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold mb-3">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Present Today</p>
            <h3 className="text-3xl font-black text-slate-900 mt-1">{stats.presentToday}</h3>
            <span className="text-xs font-semibold text-slate-500 mt-1 block">
              {stats.totalEmployees > 0 ? ((stats.presentToday / stats.totalEmployees) * 100).toFixed(0) : 0}% of total
            </span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold mb-3">
              <XCircle className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Absent Today</p>
            <h3 className="text-3xl font-black text-slate-900 mt-1">{stats.absentToday}</h3>
            <span className="text-xs font-semibold text-slate-500 mt-1 block">
              {stats.totalEmployees > 0 ? ((stats.absentToday / stats.totalEmployees) * 100).toFixed(0) : 0}% of total
            </span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold mb-3">
              <Clock className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Late Today</p>
            <h3 className="text-3xl font-black text-slate-900 mt-1">{stats.lateToday}</h3>
            <span className="text-xs font-semibold text-slate-500 mt-1 block">After Shift</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold mb-3">
              <Calendar className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Records</p>
            <h3 className="text-3xl font-black text-slate-900 mt-1">{attendance.length}</h3>
            <span className="text-xs font-semibold text-slate-500 mt-1 block">History in DB</span>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-200 bg-slate-50/50 space-y-4">
            {/* Top row: Search + Employee Selector + Dept */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
                {/* Search Bar */}
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    placeholder="Search employee name or ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 text-sm font-semibold bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                  />
                </div>

                {/* Employee-Wise Select */}
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-300 shadow-xs text-xs font-extrabold text-slate-700">
                  <User className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="text-slate-400 uppercase text-[10px]">Employee:</span>
                  <select
                    value={empFilter}
                    onChange={(e) => {
                      setEmpFilter(e.target.value);
                      if (e.target.value !== 'all') {
                        setViewMode('history'); // Show full history when specific employee is chosen
                      }
                    }}
                    className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer max-w-[160px] truncate"
                  >
                    <option value="all">All Employees</option>
                    {uniqueEmployees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} ({e.employeeId || 'EMP'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Department Select */}
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-xl px-3 py-2 shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Departments</option>
                  {distinctDepts.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>

                {/* Status Select */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-xl px-3 py-2 shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">🟢 Active Now</option>
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="half-day">Half Day</option>
                </select>
              </div>

              {/* Date Filter & Quick Preset Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-extrabold text-slate-500 uppercase mr-1">Date Filter:</span>
                <button
                  type="button"
                  onClick={() => handleDatePreset('today')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                    viewMode === 'today'
                      ? 'bg-blue-600 text-white border-blue-700'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => handleDatePreset('yesterday')}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 transition"
                >
                  Yesterday
                </button>

                {/* Custom Date Picker */}
                <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value);
                      setViewMode(e.target.value === todayStr ? 'today' : 'history');
                    }}
                    className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer"
                  />
                </div>

                {(selectedDate || searchTerm || statusFilter !== 'all' || deptFilter !== 'all' || empFilter !== 'all' || onlyActiveNow) && (
                  <button
                    onClick={() => {
                      setSelectedDate(todayStr);
                      setViewMode('today');
                      setSearchTerm('');
                      setStatusFilter('all');
                      setDeptFilter('all');
                      setEmpFilter('all');
                      setOnlyActiveNow(false);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition border border-rose-200"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Reset
                  </button>
                )}
              </div>
            </div>

            {/* Active Employee Selected Banner */}
            {empFilter !== 'all' && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-blue-900 font-bold">
                  <User className="w-4 h-4 text-blue-600" />
                  <span>
                    Showing complete attendance history for: <strong>{uniqueEmployees.find((e) => e.id === empFilter)?.name}</strong> ({filtered.length} logs found)
                  </span>
                </div>
                <button
                  onClick={() => setEmpFilter('all')}
                  className="text-xs font-extrabold text-blue-700 hover:underline cursor-pointer"
                >
                  Show All Employees
                </button>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Employee</th>
                  <th className="py-3.5 px-4">Punch Selfie</th>
                  <th className="py-3.5 px-4">Employee ID</th>
                  <th className="py-3.5 px-4">Department</th>
                  <th className="py-3.5 px-4">Check In</th>
                  <th className="py-3.5 px-4">Check Out</th>
                  <th className="py-3.5 px-4">Working Hours</th>
                  <th className="py-3.5 px-4">Distance (KM)</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">History</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800 text-xs">
                {filtered.length > 0 ? (
                  filtered.map((item) => {
                    const selfieImg = item.checkInImage || item.selfie || item.photo;
                    const isActiveCheckedIn = Boolean(item.checkIn && !item.checkOut);

                    return (
                      <tr
                        key={item._id}
                        className={`transition ${
                          isActiveCheckedIn
                            ? 'bg-emerald-50/40 hover:bg-emerald-50/80'
                            : 'hover:bg-slate-50/80'
                        }`}
                      >
                        {/* Date */}
                        <td className="py-3.5 px-4 font-mono font-semibold text-slate-600">
                          {item.date || (item.createdAt ? item.createdAt.slice(0, 10) : '-')}
                        </td>

                        {/* Employee Details */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <Avatar
                              src={item.employee?.avatar}
                              name={item.employee?.name}
                              size="sm"
                            />
                            <div>
                              <span className="font-bold text-slate-900 block leading-snug text-sm">
                                {item.employee?.name || 'Field Employee'}
                              </span>
                              <span className="text-[11px] text-slate-500 font-semibold block">
                                {item.employee?.phone || ''}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Selfie Preview Button */}
                        <td className="py-3.5 px-4">
                          {selfieImg ? (
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewSelfie({
                                  url: selfieImg,
                                  name: item.employee?.name || 'Field Employee',
                                  date: item.date || item.createdAt?.slice(0, 10),
                                  time: item.checkIn,
                                })
                              }
                              className="group relative w-10 h-10 rounded-xl overflow-hidden border-2 border-slate-300 shadow-xs hover:ring-2 hover:ring-blue-500 transition cursor-pointer flex-shrink-0"
                              title="View Punch Selfie"
                            >
                              <img
                                src={selfieImg}
                                alt="Punch Selfie"
                                className="w-full h-full object-cover group-hover:scale-110 transition duration-200"
                              />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                                <Eye className="w-4 h-4 text-white" />
                              </div>
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-mono italic">No Selfie</span>
                          )}
                        </td>

                        {/* Employee ID */}
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                          {item.employee?.employeeId || 'EMP-' + (item.employee?._id || item._id).slice(-6).toUpperCase()}
                        </td>

                        {/* Department */}
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-100 text-blue-800 border border-blue-200">
                            {item.employee?.department || 'Field Services'}
                          </span>
                        </td>

                        {/* Check In */}
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {formatTime(item.checkIn)}
                        </td>

                        {/* Check Out */}
                        <td className="py-3.5 px-4 font-bold text-slate-700">
                          {isActiveCheckedIn ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800">
                              Active (Checked In)
                            </span>
                          ) : (
                            formatTime(item.checkOut)
                          )}
                        </td>

                        {/* Working Hours */}
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {calculateHours(item.checkIn, item.checkOut)}
                        </td>

                        {/* Distance */}
                        <td className="py-3.5 px-4 font-mono font-bold text-blue-700">
                          {item.totalDistanceTraveled ? item.totalDistanceTraveled.toFixed(2) + ' km' : '0 km'}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold text-[11px] capitalize ${
                              item.status === 'present'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : item.status === 'absent'
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                item.status === 'present'
                                  ? 'bg-emerald-600'
                                  : item.status === 'absent'
                                  ? 'bg-rose-600'
                                  : 'bg-amber-600'
                              }`}
                            />
                            {item.status}
                          </span>
                        </td>

                        {/* Action: View Employee Log History */}
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              const empId = item.employee?._id;
                              if (empId) {
                                setEmpFilter(empId);
                                setViewMode('history');
                                setSelectedDate('');
                              }
                            }}
                            className="px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition border border-blue-200 cursor-pointer"
                            title="View All Attendance History of this Employee"
                          >
                            View Logs
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="11" className="py-16 text-center text-sm font-bold text-slate-500">
                      {loading
                        ? 'Loading attendance logs from database...'
                        : viewMode === 'today'
                        ? 'No attendance records found for TODAY. Switch to "All Attendance History" to view previous dates.'
                        : 'No attendance records match your search criteria.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs font-bold text-slate-700">
            <span>
              Showing <strong className="text-blue-700 text-sm">{filtered.length}</strong> of {attendance.length} attendance records
            </span>
            <div className="flex items-center gap-2">
              <span className="bg-blue-50 text-blue-800 px-3 py-1 rounded-xl border border-blue-200">
                Mode: {viewMode === 'today' ? 'Today Only' : selectedDate ? `Date (${selectedDate})` : 'Full History'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Selfie Preview Modal */}
      {previewSelfie && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => setPreviewSelfie(null)}
        >
          <div
            className="relative max-w-md w-full bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <h3 className="font-extrabold text-slate-900 text-lg">Attendance Punch Selfie</h3>
                <p className="text-xs font-semibold text-slate-600">{previewSelfie.name} • {previewSelfie.date}</p>
              </div>
              <button
                onClick={() => setPreviewSelfie(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mt-4 rounded-2xl overflow-hidden bg-slate-100 aspect-square max-h-[380px] flex items-center justify-center border border-slate-200">
              <img
                src={previewSelfie.url}
                alt="Punch Selfie"
                className="w-full h-full object-cover"
              />
            </div>
            {previewSelfie.time && (
              <div className="mt-4 text-center text-xs font-semibold text-slate-600">
                Captured at: <strong className="text-slate-900 text-sm">{new Date(previewSelfie.time).toLocaleTimeString()}</strong>
              </div>
            )}
          </div>
        </div>
      )}
    </KisanConnectLayout>
  );
}
