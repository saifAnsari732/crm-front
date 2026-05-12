import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import { leaveAPI } from '../../services/api.service';
import { Calendar, CheckCircle, XCircle, Clock, User, FileText, ChevronRight, Search } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminLeaves() {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    fetchLeaves();
  }, [filter]);

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const { data } = await leaveAPI.getAll({ status: filter === 'all' ? '' : filter });
      setLeaves(data.leaves || []);
    } catch {
      toast.error('Failed to load leaves');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (id, status) => {
    if (status === 'rejected' && !rejectionReason) {
      toast.error('Please provide a rejection reason');
      return;
    }
    try {
      await leaveAPI.updateStatus(id, { status, rejectionReason });
      toast.success(`Leave ${status} successfully`);
      setSelectedLeave(null);
      setRejectionReason('');
      fetchLeaves();
    } catch {
      toast.error('Failed to update leave status');
    }
  };

  return (
    <AdminLayout>
      <div className="p-4 lg:p-6 space-y-6 max-w-[1600px] mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-[var(--text-main)] text-2xl font-bold">Leave Requests</h1>
            <p className="text-[var(--text-muted)] text-sm">Manage employee leave applications</p>
          </div>
          <div className="flex items-center gap-2 bg-[var(--bg-card)] p-1 rounded-xl border border-[var(--border-color)]">
            {['pending', 'approved', 'rejected', 'all'].map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                  filter === s ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/20' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className={`${selectedLeave ? 'lg:col-span-7 xl:col-span-8' : 'lg:col-span-12'} space-y-4`}>
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-32 rounded-2xl bg-[var(--bg-card)] animate-pulse" />)}
              </div>
            ) : leaves.length === 0 ? (
              <div className="glass-card p-12 text-center">
                <Calendar className="w-12 h-12 text-[var(--text-muted)]/20 mx-auto mb-4" />
                <p className="text-[var(--text-muted)]">No leave requests found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {leaves.map((leave) => (
                  <div
                    key={leave._id}
                    onClick={() => setSelectedLeave(leave)}
                    className={`glass-card p-5 cursor-pointer transition-all border-2 ${
                      selectedLeave?._id === leave._id ? 'border-primary-500 bg-primary-600/5' : 'border-transparent hover:border-[var(--border-color)]'
                    }`}
                  >
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 rounded-2xl bg-[var(--bg-main)] flex items-center justify-center text-xl font-bold text-primary-500">
                        {leave.employee?.avatar ? <img src={leave.employee.avatar} className="w-full h-full rounded-2xl object-cover" /> : leave.employee?.name?.[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-[var(--text-main)] font-bold truncate">{leave.employee?.name}</h3>
                        <p className="text-[var(--text-muted)] text-xs">{leave.employee?.department} • ID: {leave.employee?.employeeId}</p>
                      </div>
                      <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest ${
                        leave.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500' :
                        leave.status === 'rejected' ? 'bg-red-500/10 text-red-400' :
                        'bg-amber-500/10 text-amber-500'
                      }`}>
                        {leave.status}
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-main)]/50">
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase text-[var(--text-muted)] font-bold">Duration</p>
                        <p className="text-[var(--text-main)] font-bold text-sm flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-primary-500" />
                          {leave.duration} Days
                        </p>
                      </div>
                      <div className="text-right space-y-1">
                        <p className="text-[10px] uppercase text-[var(--text-muted)] font-bold">Type</p>
                        <p className="text-[var(--text-main)] font-bold text-sm capitalize">{leave.type}</p>
                      </div>
                    </div>
                    <p className="text-[var(--text-muted)] text-xs mt-4 italic line-clamp-2">"{leave.reason}"</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedLeave && (
            <div className="lg:col-span-5 xl:col-span-4 animate-in slide-in-from-right-4 duration-300">
              <div className="glass-card p-6 border-primary-500/30 sticky top-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-[var(--text-main)] font-bold text-lg">Request Details</h3>
                  <button onClick={() => setSelectedLeave(null)} className="text-[var(--text-muted)] hover:text-red-400">
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--bg-main)]/50">
                    <div className="w-14 h-14 rounded-2xl bg-primary-600/20 flex items-center justify-center text-2xl font-bold text-primary-500">
                      {selectedLeave.employee?.name?.[0]}
                    </div>
                    <div>
                      <p className="text-[var(--text-main)] font-bold text-lg">{selectedLeave.employee?.name}</p>
                      <p className="text-[var(--text-muted)] text-sm">{selectedLeave.employee?.department}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl border border-[var(--border-color)]">
                      <p className="text-[10px] uppercase text-[var(--text-muted)] font-bold mb-1">From</p>
                      <p className="text-[var(--text-main)] font-bold">{new Date(selectedLeave.startDate).toLocaleDateString()}</p>
                    </div>
                    <div className="p-4 rounded-2xl border border-[var(--border-color)]">
                      <p className="text-[10px] uppercase text-[var(--text-muted)] font-bold mb-1">To</p>
                      <p className="text-[var(--text-main)] font-bold">{new Date(selectedLeave.endDate).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] uppercase text-[var(--text-muted)] font-bold px-1">Reason for Leave</p>
                    <div className="p-4 rounded-2xl bg-[var(--bg-main)]/50 border border-[var(--border-color)] text-[var(--text-main)] text-sm leading-relaxed italic">
                      "{selectedLeave.reason}"
                    </div>
                  </div>

                  {selectedLeave.status === 'pending' ? (
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase text-[var(--text-muted)] font-bold px-1">Rejection Reason (if any)</label>
                        <textarea
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          className="input-field w-full h-24 resize-none"
                          placeholder="Why is this being rejected?"
                        />
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleStatusUpdate(selectedLeave._id, 'rejected')}
                          className="flex-1 py-3 rounded-xl bg-red-500/10 text-red-400 font-bold hover:bg-red-500 hover:text-white transition-all border border-red-500/20"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleStatusUpdate(selectedLeave._id, 'approved')}
                          className="flex-2 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
                        >
                          <CheckCircle className="w-5 h-5" />
                          Approve Leave
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className={`p-4 rounded-2xl text-center font-bold ${
                      selectedLeave.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}>
                      Request was {selectedLeave.status.toUpperCase()} on {new Date(selectedLeave.approvedAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
