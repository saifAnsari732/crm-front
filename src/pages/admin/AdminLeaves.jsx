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
            <h1 className="text-[var(--text-main)] text-2xl font-black tracking-tight">Leave Requests</h1>
            <p className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-widest mt-1">Manage employee leave applications</p>
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

        <div className="flex-1 flex flex-col lg:flex-row gap-8 min-h-0">
          {/* List Section */}
          <div className={`${selectedLeave ? 'lg:w-7/12' : 'w-full'} flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-2`}>
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-40 rounded-[2rem] bg-[var(--bg-card)] animate-pulse border border-[var(--border-color)]" />)}
              </div>
            ) : leaves.length === 0 ? (
              <div className="glass-card p-20 text-center flex flex-col items-center border-[var(--border-color)]">
                <div className="w-16 h-16 rounded-2xl bg-[var(--bg-main)] flex items-center justify-center mb-6">
                   <Calendar className="w-8 h-8 text-[var(--text-muted)] opacity-20" />
                </div>
                <h3 className="text-[var(--text-main)] font-black text-lg uppercase tracking-tight">No Leave Applications</h3>
                <p className="text-[var(--text-muted)] text-sm mt-2 max-w-xs">New leave requests from employees will appear here for your review.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-10">
                {leaves.map((leave) => (
                  <div
                    key={leave._id}
                    onClick={() => setSelectedLeave(leave)}
                    className={`group glass-card p-6 cursor-pointer transition-all border-2 relative overflow-hidden ${
                      selectedLeave?._id === leave._id ? 'border-primary-500 bg-primary-600/5 shadow-2xl' : 'border-transparent hover:border-primary-500/30'
                    }`}
                  >
                    <div className="flex items-center gap-4 mb-5">
                      <div className="w-12 h-12 rounded-2xl bg-primary-600/10 border border-primary-500/20 flex items-center justify-center text-xl font-black text-primary-500 shadow-inner uppercase">
                        {leave.employee?.name?.[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-[var(--text-main)] font-black text-sm truncate group-hover:text-primary-400 transition-colors">{leave.employee?.name}</h3>
                        <p className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-widest truncate">{leave.employee?.department || 'Field Staff'}</p>
                      </div>
                      <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                        leave.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                        leave.status === 'rejected' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                        'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                      }`}>
                         <span className={`w-1 h-1 rounded-full ${
                           leave.status === 'approved' ? 'bg-emerald-500' :
                           leave.status === 'rejected' ? 'bg-red-500' : 'bg-amber-500'
                         }`} />
                        {leave.status}
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-2xl bg-[var(--bg-main)]/50 border border-[var(--border-color)]">
                      <div>
                        <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">Duration</p>
                        <div className="flex items-center gap-2">
                           <Clock className="w-3.5 h-3.5 text-primary-500" />
                           <span className="text-[var(--text-main)] font-black text-sm">{leave.duration} Days</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">Type</p>
                        <span className="text-[var(--text-main)] font-black text-xs uppercase tracking-widest">{leave.type}</span>
                      </div>
                    </div>
                    
                    <p className="text-[var(--text-muted)] text-[11px] font-medium mt-4 line-clamp-2 leading-relaxed italic border-l-2 border-primary-500/20 pl-3">
                      {leave.reason}
                    </p>
                    
                    <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                       <ChevronRight className="w-5 h-5 text-primary-500" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Inspector Panel */}
          {selectedLeave && (
            <div className="lg:w-5/12 animate-in slide-in-from-right-10 duration-500 sticky top-6 self-start">
              <div className="glass-card p-8 border-primary-500/30 shadow-2xl relative overflow-hidden flex flex-col gap-8">
                <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                   <Calendar className="w-64 h-64 -rotate-12" />
                </div>

                <div className="flex items-center justify-between">
                  <h3 className="text-[var(--text-main)] font-black text-lg uppercase tracking-tight">Request Details</h3>
                  <button onClick={() => setSelectedLeave(null)} className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all">
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-8 relative z-10">
                  <div className="flex items-center gap-5 p-5 rounded-[1.5rem] bg-[var(--bg-main)]/50 border border-[var(--border-color)]">
                    <div className="w-16 h-16 rounded-[1.25rem] bg-primary-600/10 border border-primary-500/20 flex items-center justify-center text-2xl font-black text-primary-500 shadow-inner uppercase">
                      {selectedLeave.employee?.name?.[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[var(--text-main)] font-black text-xl tracking-tight">{selectedLeave.employee?.name}</p>
                      <p className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.2em]">{selectedLeave.employee?.department || 'Field Staff'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-5 rounded-[1.5rem] border border-[var(--border-color)] bg-[var(--bg-card)]">
                      <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2">Check-In</p>
                      <p className="text-[var(--text-main)] font-black text-lg">{new Date(selectedLeave.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</p>
                    </div>
                    <div className="p-5 rounded-[1.5rem] border border-[var(--border-color)] bg-[var(--bg-card)]">
                      <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2">Check-Out</p>
                      <p className="text-[var(--text-main)] font-black text-lg">{new Date(selectedLeave.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] px-1">Application Summary</p>
                    <div className="p-6 rounded-[2rem] bg-[var(--bg-main)]/50 border border-[var(--border-color)] text-[var(--text-main)] text-sm leading-relaxed italic font-medium shadow-inner">
                      "{selectedLeave.reason}"
                    </div>
                  </div>

                  {selectedLeave.status === 'pending' ? (
                    <div className="space-y-6 pt-4">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] px-1">Action Remarks</label>
                        <textarea
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          className="input-field w-full h-32 resize-none p-4 text-sm font-medium"
                          placeholder="Provide context for approval/rejection..."
                        />
                      </div>
                      <div className="flex gap-4">
                        <button
                          onClick={() => handleStatusUpdate(selectedLeave._id, 'rejected')}
                          className="flex-1 py-4 rounded-2xl bg-red-500/10 text-red-500 font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all border border-red-500/20 active:scale-95"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleStatusUpdate(selectedLeave._id, 'approved')}
                          className="flex-[1.5] py-4 rounded-2xl bg-emerald-600 text-white font-black uppercase tracking-widest hover:bg-emerald-500 transition-all shadow-xl shadow-emerald-600/20 flex items-center justify-center gap-3 active:scale-95"
                        >
                          <CheckCircle className="w-5 h-5" />
                          Approve
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className={`p-6 rounded-[2rem] text-center border shadow-inner ${
                      selectedLeave.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
                    }`}>
                       <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Decision Logged</p>
                       <p className="text-lg font-black">{selectedLeave.status.toUpperCase()}</p>
                       <p className="text-[10px] font-bold mt-2">{new Date(selectedLeave.approvedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
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
