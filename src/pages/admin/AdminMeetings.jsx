import React, { useEffect, useState } from 'react';
import TrackProLayout from '../../components/layout/TrackProLayout';
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

export function AdminMeetings() {
  const [meetings, setMeetings] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [empFilter, setEmpFilter] = useState('');
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
        limit: 20,
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

  return (
    <TrackProLayout>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <Briefcase className="w-6 h-6 text-blue-600" />
              Field Visits & Client Meetings
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Real-time audit of field executive visits, client discussions, store locations, and visit selfies.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="px-3.5 py-1.5 rounded-xl bg-blue-50 text-blue-700 font-bold text-xs border border-blue-200 shadow-2xs">
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
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-[280px]">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search by client, shop, mobile, address, notes, employee..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <select
              value={empFilter}
              onChange={(e) => {
                setEmpFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none"
            >
              <option value="">All Field Employees</option>
              {employees.map((e) => (
                <option key={e._id} value={e._id}>
                  {e.name}
                </option>
              ))}
            </select>

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
                      No client visit records found.
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
                              className="text-[10px] text-blue-600 hover:underline inline-flex items-center gap-1 font-mono mt-0.5"
                            >
                              <Phone className="w-2.5 h-2.5" /> {m.mobileNumber}
                            </a>
                          )}
                        </td>

                        {/* Visit Selfie Photo Thumbnail */}
                        <td className="py-3.5 px-4">
                          {visitImg ? (
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewImage({
                                  url: visitImg,
                                  client: m.clientName,
                                  emp: m.employee?.name,
                                  date: m.date,
                                  notes: m.meetingNotes,
                                })
                              }
                              className="group relative w-10 h-10 rounded-xl overflow-hidden border border-slate-200 shadow-2xs hover:ring-2 hover:ring-blue-500 transition cursor-pointer flex-shrink-0"
                              title="Click to view visit selfie"
                            >
                              <img
                                src={visitImg}
                                alt="Visit Selfie"
                                className="w-full h-full object-cover group-hover:scale-110 transition duration-200"
                              />
                              <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                                <Eye className="w-3.5 h-3.5 text-white" />
                              </div>
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-mono italic">No Photo</span>
                          )}
                        </td>

                        {/* Address */}
                        <td className="py-3.5 px-4 max-w-[200px]">
                          <span className="text-slate-700 block truncate" title={m.meetingAddress}>
                            {m.meetingAddress || '—'}
                          </span>
                        </td>

                        {/* Notes */}
                        <td className="py-3.5 px-4 max-w-[180px]">
                          <span className="text-slate-600 italic block truncate" title={m.meetingNotes}>
                            {m.meetingNotes || '—'}
                          </span>
                        </td>

                        {/* Deal Value */}
                        <td className="py-3.5 px-4 text-right font-mono font-bold">
                          {m.dealAmount > 0 ? (
                            <span className="text-emerald-600">₹{m.dealAmount.toLocaleString()}</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        {/* Date */}
                        <td className="py-3.5 px-4 font-mono text-slate-500 whitespace-nowrap">
                          {new Date(m.date || m.createdAt).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold text-[10px] capitalize ${
                              m.status === 'completed'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : m.status === 'scheduled'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : m.status === 'follow-up'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                m.status === 'completed'
                                  ? 'bg-emerald-500'
                                  : m.status === 'scheduled'
                                  ? 'bg-blue-500'
                                  : m.status === 'follow-up'
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                              }`}
                            ></span>
                            {m.status || 'scheduled'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleDelete(m._id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
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

          {/* Table Footer with Pagination */}
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing {filteredMeetings.length} of {total} visits recorded
            </span>

            {total > 20 && (
              <div className="flex items-center gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition"
                >
                  <ChevronLeft className="w-3.5 h-3.5 inline mr-1" /> Previous
                </button>
                <span className="font-semibold text-slate-800">
                  Page {page} of {Math.ceil(total / 20)}
                </span>
                <button
                  disabled={page * 20 >= total}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition"
                >
                  Next <ChevronRight className="w-3.5 h-3.5 inline ml-1" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Visit Selfie Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-md w-full bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Client Visit Selfie</h3>
                <p className="text-[11px] text-slate-500">
                  {previewImage.client} • {previewImage.emp}
                </p>
              </div>
              <button
                onClick={() => setPreviewImage(null)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-4 rounded-2xl overflow-hidden bg-slate-100 aspect-square max-h-[380px] flex items-center justify-center border border-slate-200">
              <img
                src={previewImage.url}
                alt="Client Visit Selfie"
                className="w-full h-full object-cover"
              />
            </div>
            {previewImage.notes && (
              <div className="mt-3 p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600">
                <span className="font-semibold text-slate-800">Visit Notes: </span>
                {previewImage.notes}
              </div>
            )}
          </div>
        </div>
      )}
    </TrackProLayout>
  );
}

export default AdminMeetings;
