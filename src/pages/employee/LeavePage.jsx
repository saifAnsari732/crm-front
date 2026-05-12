import React, { useState, useEffect } from 'react';
import EmployeeLayout from '../../components/layout/EmployeeLayout';
import { leaveAPI } from '../../services/api.service';
import { Calendar, Clock, AlertCircle, FileText, Send, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LeavePage() {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    type: 'casual',
    startDate: '',
    endDate: '',
    reason: '',
  });

  useEffect(() => {
    fetchLeaves();
  }, []);

  const fetchLeaves = async () => {
    try {
      const { data } = await leaveAPI.getMy();
      setLeaves(data.leaves || []);
    } catch {
      toast.error('Failed to load leaves');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await leaveAPI.apply(formData);
      toast.success('Leave application submitted');
      setShowForm(false);
      setFormData({ type: 'casual', startDate: '', endDate: '', reason: '' });
      fetchLeaves();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to apply for leave');
    }
  };

  return (
    <EmployeeLayout>
      <div className="p-4 lg:p-6 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white text-2xl font-bold">Leave Management</h1>
            <p className="text-white/50 text-sm">Apply for and track your leave requests</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="btn-primary py-2 px-6 rounded-xl flex items-center gap-2"
          >
            {showForm ? 'Cancel' : 'Apply for Leave'}
          </button>
        </div>

        {showForm && (
          <div className="glass-card p-6 border-primary-500/30 animate-in fade-in slide-in-from-top-4 duration-300">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary-400" />
              New Leave Application
            </h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-white/60 text-xs font-semibold uppercase tracking-wider">Leave Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="input-field w-full"
                  required
                >
                  <option value="casual">Casual Leave</option>
                  <option value="sick">Sick Leave</option>
                  <option value="annual">Annual Leave</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-white/60 text-xs font-semibold uppercase tracking-wider">Reason</label>
                <input
                  type="text"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="Why are you taking leave?"
                  className="input-field w-full"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-white/60 text-xs font-semibold uppercase tracking-wider">Start Date</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="input-field w-full"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-white/60 text-xs font-semibold uppercase tracking-wider">End Date</label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="input-field w-full"
                  required
                />
              </div>
              <div className="md:col-span-2 pt-2">
                <button type="submit" className="btn-primary w-full py-3 rounded-xl flex items-center justify-center gap-2">
                  <Send className="w-4 h-4" />
                  Submit Application
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="space-y-4">
          <h3 className="text-white/60 text-xs font-semibold uppercase tracking-wider">Recent Applications</h3>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-2xl bg-white/5 animate-pulse" />)}
            </div>
          ) : leaves.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <Calendar className="w-12 h-12 text-white/10 mx-auto mb-4" />
              <p className="text-white/40">No leave applications found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {leaves.map((leave) => (
                <div key={leave._id} className="glass-card p-4 flex items-center justify-between group hover:border-primary-500/50 transition-all">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                      leave.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400' :
                      leave.status === 'rejected' ? 'bg-red-500/10 text-red-400' :
                      'bg-amber-500/10 text-amber-400'
                    }`}>
                      <Calendar className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-bold capitalize">{leave.type} Leave</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          leave.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' :
                          leave.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                          'bg-amber-500/20 text-amber-400'
                        }`}>
                          {leave.status}
                        </span>
                      </div>
                      <p className="text-white/40 text-xs mt-0.5">
                        {new Date(leave.startDate).toLocaleDateString()} - {new Date(leave.endDate).toLocaleDateString()}
                        <span className="mx-2">•</span>
                        {leave.duration} Days
                      </p>
                    </div>
                  </div>
                  <div className="text-right hidden md:block">
                    <p className="text-white/60 text-xs italic">"{leave.reason}"</p>
                    {leave.status === 'rejected' && leave.rejectionReason && (
                      <p className="text-red-400 text-[10px] mt-1 flex items-center justify-end gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {leave.rejectionReason}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-white/10 group-hover:text-primary-500 transition-colors" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </EmployeeLayout>
  );
}
