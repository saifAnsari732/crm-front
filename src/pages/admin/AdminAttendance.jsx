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
} from 'lucide-react';
import { API } from '../../services/api.service';
import toast from 'react-hot-toast';
import Avatar from '../../components/shared/Avatar';

export default function AdminAttendance() {
  const [attendance, setAttendance] = useState([]);
  const [previewSelfie, setPreviewSelfie] = useState(null);
  const [stats, setStats] = useState({
    totalEmployees: 0,
    presentToday: 0,
    absentToday: 0,
    lateToday: 0,
    halfDayToday: 0,
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'today', 'present', 'absent', 'half-day'
  const [deptFilter, setDeptFilter] = useState('all');
  const [selectedDate, setSelectedDate] = useState(''); // YYYY-MM-DD
  const [onlyActiveNow, setOnlyActiveNow] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchAttendanceData = async () => {
    try {
      setLoading(true);
      const attRes = await API.get('/admin/attendance').catch(() => ({ data: { success: false } }));

      if (attRes.data?.success && Array.isArray(attRes.data.records)) {
        setAttendance(attRes.data.records);
        if (attRes.data.stats) {
          setStats(attRes.data.stats);
        }
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

  const todayStr = new Date().toISOString().slice(0, 10);

  const distinctDepts = Array.from(
    new Set(attendance.map((a) => a.employee?.department).filter(Boolean))
  );

  // Count currently active employees (checked in today and haven't checked out yet)
  const activeNowCount = attendance.filter((a) => {
    const isToday = (a.date === todayStr) || (!a.date && a.createdAt?.startsWith(todayStr));
    return isToday && a.checkIn && !a.checkOut;
  }).length;

  const filtered = attendance.filter((a) => {
    const empName = a.employee?.name || 'Unknown Employee';
    const empId = a.employee?.employeeId || '';
    const empDept = a.employee?.department || '';
    const recordDate = a.date || (a.createdAt ? a.createdAt.slice(0, 10) : '');

    const matchesSearch =
      empName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      empId.toLowerCase().includes(searchTerm.toLowerCase());

    const isToday = recordDate === todayStr;
    const isCheckedInActive = Boolean(a.checkIn && !a.checkOut);

    let matchesStatus = true;
    if (onlyActiveNow || statusFilter === 'active') {
      matchesStatus = isToday && isCheckedInActive;
    } else if (statusFilter === 'today') {
      matchesStatus = isToday;
    } else if (statusFilter !== 'all') {
      matchesStatus = a.status?.toLowerCase() === statusFilter.toLowerCase();
    }

    const matchesDept = deptFilter === 'all' || empDept === deptFilter;

    let matchesDate = true;
    if (selectedDate) {
      matchesDate = recordDate === selectedDate;
    }

    return matchesSearch && matchesStatus && matchesDept && matchesDate;
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

  return (
    <KisanConnectLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Attendance Management</h1>
            <p className="text-base font-medium text-slate-600 mt-1">
              Track real-time active employees, filter by date, and manage team attendance logs.
            </p>
          </div>

          <div className="flex flex-wrap items-center ">
            {/* Top Date Wise Find Option */}
            <div className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 transition px-4 py-2.5 rounded-xl border-2 border-blue-500/30 text-sm font-bold text-slate-800 shadow-xs">
              <Calendar className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <span className="text-xs text-slate-500 uppercase tracking-wider font-bold">Find Date:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-sm font-bold text-slate-900 focus:outline-none cursor-pointer"
              />
              {selectedDate && (
                <button
                  onClick={() => setSelectedDate('')}
                  className="ml-1 text-xs text-rose-600 hover:bg-rose-100 font-extrabold px-2 py-0.5 rounded-lg border border-rose-200 transition"
                  title="Show All Dates"
                >
                  Clear
                </button>
              )}
            </div>

            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="text-sm font-bold text-slate-800 bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Departments</option>
              {distinctDepts.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            <button
              onClick={() => toast.success('Attendance report exported as CSV!')}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md transition"
            >
              <Download className="w-4 h-4" /> Export Report
            </button>
          </div>
        </div>

        {/* 6 KisanConnect KPI Cards (Large Text) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold mb-3">
              <Users className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Employees</p>
            <h3 className="text-3xl font-black text-slate-900 mt-1">{stats.totalEmployees}</h3>
            <span className="text-xs font-bold text-emerald-600 mt-1 block">Live from DB</span>
          </div>

          {/* Currently Active KPI Card (Clickable to Filter Active Only) */}
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
          <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-5 h-5 text-slate-400 absolute left-4 top-3" />
                <input
                  type="text"
                  placeholder="Search by employee name or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 text-base font-semibold bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                />
              </div>

              {/* Quick Filter Active Only Button */}
              <button
                type="button"
                onClick={() => setOnlyActiveNow(!onlyActiveNow)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition shadow-xs border ${
                  onlyActiveNow
                    ? 'bg-emerald-600 text-white border-emerald-700 ring-2 ring-emerald-300'
                    : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50'
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${onlyActiveNow ? 'bg-white animate-ping' : 'bg-emerald-500'}`} />
                {onlyActiveNow ? 'Showing Active Only' : 'Filter Active Employees'}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Date Filter Input in Table Bar */}
              <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-bold text-slate-700">
                <span className="text-xs text-slate-400 font-bold uppercase">Date:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent text-sm font-bold text-slate-900 focus:outline-none cursor-pointer"
                />
                {selectedDate && (
                  <button
                    onClick={() => setSelectedDate('')}
                    className="text-xs text-slate-400 hover:text-rose-600 font-extrabold"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Status Filter Dropdown */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-sm font-bold text-slate-800 bg-white border border-slate-300 rounded-xl px-4 py-2.5 shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="active">🟢 Active Now (Checked In)</option>
                <option value="today">📅 Today's Logs</option>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="half-day">Half Day</option>
              </select>

              {(selectedDate || searchTerm || statusFilter !== 'all' || deptFilter !== 'all' || onlyActiveNow) && (
                <button
                  onClick={() => {
                    setSelectedDate('');
                    setSearchTerm('');
                    setStatusFilter('all');
                    setDeptFilter('all');
                    setOnlyActiveNow(false);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Reset Filters
                </button>
              )}
            </div>
          </div>

          {/* Table with Large Readable Text */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-500  text-sm uppercase tracking-wider">
                  <th className="py-4 px-5">Date</th>
                  <th className="py-4 px-5">Employee</th>
                  <th className="py-4 px-5">Punch Selfie</th>
                  <th className="py-4 px-5">Employee ID</th>
                  <th className="py-4 px-5">Department</th>
                  <th className="py-4 px-5">Check In</th>
                  <th className="py-4 px-5">Check Out</th>
                  <th className="py-4 px-5">Working Hours</th>
                  <th className="py-4 px-5">Distance (KM)</th>
                  <th className="py-4 px-5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800 ">
                {filtered.length > 0 ? (
                  filtered.map((item) => {
                    const selfieImg = item.checkInImage || item.selfie || item.photo;
                    const isActiveCheckedIn = Boolean(item.checkIn && !item.checkOut);

                    return (
                      <tr
                        key={item._id}
                        className={`transition ${
                          isActiveCheckedIn
                            ? 'bg-emerald-50/40 hover:bg-emerald-50/80 '
                            : 'hover:bg-slate-50/80'
                        }`}
                      >
                        {/* Date */}
                        <td className="py-4 px-5 font-mono text-sm font-semibold text-slate-500">
                          {item.date || (item.createdAt ? item.createdAt.slice(0, 10) : '-')}
                        </td>

                        {/* Employee Details */}
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3">
                            <Avatar
                              src={item.employee?.avatar}
                              name={item.employee?.name}
                              size="md"
                            />
                            <div>
                              <span className="font-semibold text-slate-500 text-base block leading-snug">
                                {item.employee?.name || 'Field Employee'}
                              </span>
                              <span className="text-xs text-slate-500 font-semibold block">
                                {item.employee?.phone || ''}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Selfie Preview Button */}
                        <td className="py-4 px-5">
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
                              className="group relative w-11 h-11 rounded-xl overflow-hidden border-2 border-slate-300 shadow-xs hover:ring-2 hover:ring-blue-500 transition cursor-pointer flex-shrink-0"
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
                            <span className="text-xs text-slate-400 font-mono italic">No Selfie</span>
                          )}
                        </td>

                        {/* Employee ID */}
                        <td className="py-4 px-5 font-mono text-sm font-bold text-slate-700">
                          {item.employee?.employeeId || 'EMP-' + (item.employee?._id || item._id).slice(-6).toUpperCase()}
                        </td>

                        {/* Department */}
                        <td className="py-4 px-5">
                          <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-blue-100 text-blue-800 border border-blue-200">
                            {item.employee?.department || 'Field Services'}
                          </span>
                        </td>

                        {/* Check In */}
                        <td className="py-4 px-5 font-semibold text-base text-slate-900">
                          {formatTime(item.checkIn)}
                        </td>

                        {/* Check Out */}
                        <td className="py-4 px-5 text-base font-semibold text-slate-700">
                          {isActiveCheckedIn ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-800">
                              Active (Checked In)
                            </span>
                          ) : (
                            formatTime(item.checkOut)
                          )}
                        </td>

                        {/* Working Hours */}
                        <td className="py-4 px-5 font-semibold text-base text-slate-900">
                          {calculateHours(item.checkIn, item.checkOut)}
                        </td>

                        {/* Distance */}
                        <td className="py-4 px-5 font-mono text-base font-semibold text-blue-700">
                          {item.totalDistanceTraveled ? item.totalDistanceTraveled.toFixed(2) + ' km' : '0 km'}
                        </td>

                        {/* Status */}
                        <td className="py-4 px-5">
                          <span
                            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full font-semibold text-xs capitalize ${
                              item.status === 'present'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : item.status === 'absent'
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
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
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="10" className="py-16 text-center text-base font-bold text-slate-500">
                      {loading ? 'Loading attendance logs from database...' : 'No attendance records found for selected criteria.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-sm font-bold text-slate-700">
            <span>Showing <strong className="text-blue-700 text-base">{filtered.length}</strong> of {attendance.length} attendance records</span>
            {selectedDate && (
              <span className="bg-blue-50 text-blue-800 px-3 py-1 rounded-xl border border-blue-200">
                Filtered Date: {selectedDate}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Attendance Punch Selfie Preview Modal */}
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
                <p className="text-sm font-semibold text-slate-600">{previewSelfie.name} • {previewSelfie.date}</p>
              </div>
              <button
                onClick={() => setPreviewSelfie(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mt-4 rounded-2xl overflow-hidden bg-slate-100 aspect-square max-h-[400px] flex items-center justify-center border border-slate-200">
              <img
                src={previewSelfie.url}
                alt="Punch Selfie"
                className="w-full h-full object-cover"
              />
            </div>
            {previewSelfie.time && (
              <div className="mt-4 text-center text-sm font-semibold text-slate-600">
                Captured at: <strong className="text-slate-900 text-base">{new Date(previewSelfie.time).toLocaleTimeString()}</strong>
              </div>
            )}
          </div>
        </div>
      )}
    </KisanConnectLayout>
  );
}
