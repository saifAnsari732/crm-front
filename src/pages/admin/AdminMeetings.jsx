import React, { useEffect, useState } from 'react';
import KisanConnectLayout from '../../components/layout/KisanConnectLayout';
import { meetingAPI, API } from '../../services/api.service';
import toast from 'react-hot-toast';
import {
  Briefcase,
  Search,
  Filter,
  X,
  Trash2,
  Calendar,
  MapPin,
  Phone,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Store,
  User,
  RefreshCw,
} from 'lucide-react';
import Avatar from '../../components/shared/Avatar';

const getMeetingImage = (m) => {
  if (!m) return '';
  const candidates = [
    m.selfieUrl,
    m.checkInImage,
    m.selfie,
    m.photo,
    m.image,
    m.imageUrl,
    m.checkInPhoto,
    m.images,
    m.media,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length) {
      if (typeof candidate[0] === 'string' && candidate[0].trim()) return candidate[0];
    }
    if (typeof candidate === 'string' && candidate.trim()) return candidate;
  }

  return '';
};

export default function AdminMeetings() {
  const todayStr = new Date().toISOString().slice(0, 10);

  const [meetings, setMeetings] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [empFilter, setEmpFilter] = useState('');
  const [selectedDate, setSelectedDate] = useState(''); // Date filter (YYYY-MM-DD)
  const [searchTerm, setSearchTerm] = useState('');
  const [previewImage, setPreviewImage] = useState(null);
  const [selectedMeeting, setSelectedMeeting] = useState(null);

  useEffect(() => {
    API.get('/employees')
      .then((res) => {
        if (res.data?.success && res.data.employees) {
          setEmployees(res.data.employees);
        }
      })
      .catch(() => {});
  }, []);

  const fetchMeetings = async () => {
    setLoading(true);
    try {
      const res = await meetingAPI.getAll({
        page,
        limit: 50,
        status: statusFilter || undefined,
        employeeId: empFilter || undefined,
      });
      setMeetings(res.data?.meetings || []);
      setTotal(res.data?.total || 0);
    } catch (err) {
      console.warn('Failed to fetch meetings:', err);
      toast.error('Failed to load meetings data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeetings();
  }, [page, statusFilter, empFilter]);

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this client visit record?')) return;
    try {
      await meetingAPI.delete(id);
      toast.success('Meeting deleted successfully');
      fetchMeetings();
    } catch {
      toast.error('Failed to delete meeting');
    }
  };

  const filteredMeetings = meetings.filter((m) => {
    // Filter by Date if selected
    if (selectedDate) {
      const recordDate = m.date || (m.createdAt ? m.createdAt.slice(0, 10) : '');
      if (recordDate !== selectedDate) return false;
    }

    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const client = (m.clientName || '').toLowerCase();
    const company = (m.companyName || '').toLowerCase();
    const emp = (m.employee?.name || '').toLowerCase();
    const phone = (m.mobileNumber || '').toLowerCase();
    const address = (m.meetingAddress || '').toLowerCase();
    const notes = (m.meetingNotes || '').toLowerCase();
    return (
      client.includes(term) ||
      company.includes(term) ||
      emp.includes(term) ||
      phone.includes(term) ||
      address.includes(term) ||
      notes.includes(term)
    );
  });

  const selectedEmpObj = employees.find((e) => e._id === empFilter);

  return (
    <KisanConnectLayout>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <Briefcase className="w-6 h-6 text-blue-600" />
              Field Visits & Client Meetings
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Real-time audit of field executive visits, client discussions, store locations, and visit selfies.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3.5 py-1.5 rounded-xl bg-blue-50 text-blue-700 font-bold text-xs border border-blue-200 shadow-xs">
              {total} Total Visits in DB
            </span>
          </div>
        </div>

        {/* 4 Summary KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold mb-2">
              <Briefcase className="w-4 h-4" />
            </div>
            <p className="text-[11px] font-medium text-slate-500">Total Visits</p>
            <h3 className="text-xl font-bold text-slate-900 mt-0.5">{total}</h3>
            <span className="text-[10px] text-blue-600 font-semibold block">Client interactions</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold mb-2">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <p className="text-[11px] font-medium text-slate-500">Completed Visits</p>
            <h3 className="text-xl font-bold text-slate-900 mt-0.5">
              {meetings.filter((m) => m.status === 'completed').length}
            </h3>
            <span className="text-[10px] text-emerald-600 font-semibold block">Executed</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold mb-2">
              <Clock className="w-4 h-4" />
            </div>
            <p className="text-[11px] font-medium text-slate-500">Scheduled / Follow-up</p>
            <h3 className="text-xl font-bold text-slate-900 mt-0.5">
              {meetings.filter((m) => m.status === 'scheduled' || m.status === 'follow-up').length}
            </h3>
            <span className="text-[10px] text-amber-600 font-semibold block">Pipeline</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold mb-2">
              <Store className="w-4 h-4" />
            </div>
            <p className="text-[11px] font-medium text-slate-500">Total Field Agents</p>
            <h3 className="text-xl font-bold text-slate-900 mt-0.5">{employees.length}</h3>
            <span className="text-[10px] text-purple-600 font-semibold block">Active in field</span>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
              {/* Search Bar */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Search client, shop, mobile, notes, employee..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Employee Filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700">
                <User className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="text-[10px] text-slate-400 font-bold uppercase">Employee:</span>
                <select
                  value={empFilter}
                  onChange={(e) => {
                    setEmpFilter(e.target.value);
                    setPage(1);
                  }}
                  className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer max-w-[150px] truncate"
                >
                  <option value="">All Field Employees</option>
                  {employees.map((e) => (
                    <option key={e._id} value={e._id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none"
              >
                <option value="">All Statuses</option>
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="follow-up">Follow-Up</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {/* Date Filter & Presets */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase mr-1">Date:</span>
              <button
                type="button"
                onClick={() => setSelectedDate(todayStr)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                  selectedDate === todayStr
                    ? 'bg-blue-600 text-white border-blue-700'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() - 1);
                  setSelectedDate(d.toISOString().slice(0, 10));
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 transition"
              >
                Yesterday
              </button>

              {/* Date Input */}
              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer"
                />
              </div>

              {(selectedDate || empFilter || statusFilter || searchTerm) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDate('');
                    setEmpFilter('');
                    setStatusFilter('');
                    setSearchTerm('');
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition border border-rose-200"
                >
                  <RefreshCw className="w-3 h-3" /> Reset
                </button>
              )}
            </div>
          </div>

          {/* Active Employee Filter Banner */}
          {selectedEmpObj && (
            <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-xs font-bold text-blue-900">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" />
                <span>Showing visits for employee: <strong>{selectedEmpObj.name}</strong> ({filteredMeetings.length} visits found)</span>
              </div>
              <button onClick={() => setEmpFilter('')} className="text-blue-700 hover:underline">
                Clear Employee Filter
              </button>
            </div>
          )}
        </div>

        {/* Table of Meetings */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-semibold uppercase">
                  <th className="py-3 px-4">Field Agent</th>
                  <th className="py-3 px-4">Client / Store</th>
                  <th className="py-3 px-4">Visit Selfie</th>
                  <th className="py-3 px-4">Location / Address</th>
                  <th className="py-3 px-4">Meeting Notes</th>
                  <th className="py-3 px-4 text-right">Deal Value</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan="9" className="py-12 text-center text-xs text-slate-400">
                      Loading visit records from database...
                    </td>
                  </tr>
                ) : filteredMeetings.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="py-12 text-center text-xs text-slate-400">
                      No client visit records found for selected criteria.
                    </td>
                  </tr>
                ) : (
                  filteredMeetings.map((m) => {
                    const visitImg = getMeetingImage(m);
                    return (
                      <tr key={m._id} className="hover:bg-slate-50/60 transition">
                        {/* Field Agent Avatar + Name */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <Avatar
                              src={m.employee?.avatar}
                              name={m.employee?.name}
                              size="sm"
                            />
                            <div>
                              <span className="font-bold text-slate-900 block leading-tight">
                                {m.employee?.name || 'Field Executive'}
                              </span>
                              <span className="text-[10px] text-slate-400 block font-mono">
                                {m.employee?.employeeId || 'EMP-' + (m.employee?._id || m._id).slice(-4).toUpperCase()}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Client & Shop Name + Mobile */}
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-900 block leading-tight">
                            {m.clientName || 'Client'}
                          </span>
                          <span className="text-[11px] text-slate-500 block">
                            {m.companyName || 'Store / Business'}
                          </span>
                          {m.mobileNumber && (
                            <a
                              href={`tel:${m.mobileNumber}`}
                              className="text-[10px] text-blue-600 hover:underline flex items-center gap-1 font-semibold mt-0.5"
                            >
                              <Phone className="w-3 h-3" />
                              {m.mobileNumber}
                            </a>
                          )}
                        </td>

                        {/* Visit Selfie Preview */}
                        <td className="py-3.5 px-4">
                          {visitImg ? (
                            <button
                              type="button"
                              onClick={() => setPreviewImage(visitImg)}
                              className="group relative w-9 h-9 rounded-xl overflow-hidden border border-slate-200 shadow-xs hover:ring-2 hover:ring-blue-500 transition cursor-pointer flex-shrink-0"
                              title="View Visit Photo"
                            >
                              <img
                                src={visitImg}
                                alt="Visit Selfie"
                                className="w-full h-full object-cover group-hover:scale-110 transition duration-200"
                              />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                                <Eye className="w-3.5 h-3.5 text-white" />
                              </div>
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-mono italic">No Photo</span>
                          )}
                        </td>

                        {/* Location / Address */}
                        <td className="py-3.5 px-4 max-w-[180px]">
                          <span className="text-slate-800 font-medium block truncate" title={m.meetingAddress}>
                            {m.meetingAddress || m.locationName || 'Field Location'}
                          </span>
                        </td>

                        {/* Meeting Notes */}
                        <td className="py-3.5 px-4 max-w-[200px]">
                          <span className="text-slate-600 block truncate" title={m.meetingNotes}>
                            {m.meetingNotes || '-'}
                          </span>
                        </td>

                        {/* Deal Value */}
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                          {m.dealValue ? `₹${Number(m.dealValue).toLocaleString('en-IN')}` : '-'}
                        </td>

                        {/* Date */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-slate-600 font-medium">
                          {m.date || (m.createdAt ? new Date(m.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-')}
                        </td>

                        {/* Status Badge */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                              m.status === 'completed'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : m.status === 'scheduled'
                                ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                : m.status === 'follow-up'
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-slate-100 text-slate-700 border border-slate-300'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                m.status === 'completed'
                                  ? 'bg-emerald-600'
                                  : m.status === 'scheduled'
                                  ? 'bg-blue-600'
                                  : m.status === 'follow-up'
                                  ? 'bg-amber-600'
                                  : 'bg-slate-500'
                              }`}
                            />
                            {m.status || 'Scheduled'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => handleDelete(m._id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            title="Delete Visit Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Photo Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-md w-full bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <h3 className="font-extrabold text-slate-900 text-base">Field Visit Selfie</h3>
              <button
                onClick={() => setPreviewImage(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mt-4 rounded-2xl overflow-hidden bg-slate-100 aspect-square max-h-[380px] flex items-center justify-center border border-slate-200">
              <img
                src={previewImage}
                alt="Visit Photo"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      )}
    </KisanConnectLayout>
  );
}
