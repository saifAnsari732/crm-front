import React, { useState, useEffect } from 'react';
import EmployeeLayout from '../../components/layout/EmployeeLayout';
import { meetingAPI } from '../../services/api.service';
import toast from 'react-hot-toast';
import { Plus, Users, X, ChevronDown, Search, Calendar, DollarSign, Phone, Building } from 'lucide-react';

const STATUS_OPTIONS = ['scheduled', 'completed', 'cancelled', 'follow-up'];
const INITIAL = { clientName: '', companyName: '', mobileNumber: '', meetingAddress: '', meetingNotes: '', status: 'scheduled', dealAmount: '', followUpDate: '' };

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(INITIAL);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => { fetchMeetings(); }, [page]);

  const fetchMeetings = async () => {
    setLoading(true);
    try {
      const { data } = await meetingAPI.getMy({ page, limit: 10 });
      setMeetings(data.meetings || []);
      setTotal(data.total || 0);
    } catch { toast.error('Failed to load meetings'); }
    finally { setLoading(false); }
  };

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.clientName) return toast.error('Client name is required');
    setSaving(true);
    try {
      await meetingAPI.create({ ...form, dealAmount: Number(form.dealAmount) || 0 });
      toast.success('✅ Meeting added!');
      setShowForm(false);
      setForm(INITIAL);
      fetchMeetings();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const filtered = meetings.filter(m =>
    !filter || m.clientName.toLowerCase().includes(filter.toLowerCase()) ||
    m.companyName?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <EmployeeLayout>
      <div className="p-4 lg:p-6 space-y-5 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[var(--text-main)] text-2xl font-bold">Meetings</h1>
            <p className="text-[var(--text-muted)] text-sm">{total} total meetings</p>
          </div>
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 py-2.5 px-4 text-sm">
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] opacity-50" />
          <input className="input-field pl-10" placeholder="Search by client or company..." value={filter} onChange={e => setFilter(e.target.value)} />
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 rounded-2xl bg-white/5 animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="glass-card p-10 text-center">
            <div className="text-4xl mb-3">🤝</div>
            <p className="text-[var(--text-main)] opacity-50 font-medium">No meetings found</p>
            <p className="text-[var(--text-muted)] text-sm mt-1">Tap the Add button to log your first meeting</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(m => <MeetingCard key={m._id} meeting={m} />)}
          </div>
        )}

        {/* Pagination */}
        {total > 10 && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-ghost px-4 py-2 text-sm disabled:opacity-40">← Prev</button>
            <span className="text-[var(--text-muted)] text-sm">{page} / {Math.ceil(total / 10)}</span>
            <button disabled={page * 10 >= total} onClick={() => setPage(p => p + 1)} className="btn-ghost px-4 py-2 text-sm disabled:opacity-40">Next →</button>
          </div>
        )}
      </div>

      {/* Add Meeting Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="w-full max-w-lg glass-card p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[var(--text-main)] font-bold text-lg">Log Meeting</h2>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-xl hover:bg-[var(--bg-card-hover)]"><X className="w-5 h-5 text-[var(--text-muted)]" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Client Name *" icon={Users} placeholder="John Smith" value={form.clientName} onChange={set('clientName')} required />
                <Field label="Company Name" icon={Building} placeholder="ABC Corp" value={form.companyName} onChange={set('companyName')} />
                <Field label="Mobile Number" icon={Phone} type="tel" placeholder="+91 98765 43210" value={form.mobileNumber} onChange={set('mobileNumber')} />
                <Field label="Deal Amount (₹)" icon={DollarSign} type="number" placeholder="0" value={form.dealAmount} onChange={set('dealAmount')} />
              </div>
              <Field label="Meeting Address" placeholder="Office address or location" value={form.meetingAddress} onChange={set('meetingAddress')} />
              <div>
                <label className="block text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider mb-1.5">Meeting Notes</label>
                <textarea rows={3} className="input-field resize-none" placeholder="Key points discussed..." value={form.meetingNotes} onChange={set('meetingNotes')} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider mb-1.5">Status</label>
                  <select className="input-field" value={form.status} onChange={set('status')}>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s} className="bg-[var(--bg-sidebar)] capitalize">{s}</option>)}
                  </select>
                </div>
                <Field label="Follow-up Date" icon={Calendar} type="date" value={form.followUpDate} onChange={set('followUpDate')} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-ghost flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Save Meeting'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </EmployeeLayout>
  );
}

function MeetingCard({ meeting: m }) {
  const statusColors = { completed: 'badge-green', pending: 'badge-yellow', scheduled: 'badge-blue', 'follow-up': 'badge-yellow', cancelled: 'badge-red' };
  return (
    <div className="glass-card p-4 flex items-start gap-4 hover:border-white/20 transition-all">
      <div className="w-11 h-11 rounded-xl bg-violet-500/20 flex items-center justify-center flex-shrink-0 text-lg">🤝</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[var(--text-main)] font-semibold">{m.clientName}</p>
            {m.companyName && <p className="text-[var(--text-muted)] text-xs">{m.companyName}</p>}
          </div>
          <span className={`badge ${statusColors[m.status] || 'badge-blue'} capitalize flex-shrink-0`}>{m.status}</span>
        </div>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {m.dealAmount > 0 && <span className="text-emerald-500 text-xs font-semibold">₹{m.dealAmount.toLocaleString()}</span>}
          <span className="text-[var(--text-muted)] text-xs">{new Date(m.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          {m.followUpDate && <span className="text-amber-500 text-xs">↩ {new Date(m.followUpDate).toLocaleDateString('en-IN')}</span>}
        </div>
        {m.meetingNotes && <p className="text-[var(--text-muted)] text-xs mt-1 line-clamp-1 italic">{m.meetingNotes}</p>}
      </div>
    </div>
  );
}

function Field({ label, icon: Icon, ...props }) {
  return (
    <div className="w-full">
      {label && <label className="block text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider mb-1.5">{label}</label>}
      <div className="relative">
        {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] opacity-50" />}
        <input className={`input-field ${Icon ? 'pl-10' : ''}`} {...props} />
      </div>
    </div>
  );
}
