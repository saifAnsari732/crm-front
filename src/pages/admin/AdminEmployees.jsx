import React, { useEffect, useState } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import { adminAPI } from '../../services/api.service';
import toast from 'react-hot-toast';
import { Search, Users, UserCheck, UserX, Shield, ShieldOff, CheckCircle, Clock, AlertTriangle, Activity, Edit2, X, MapPin, IndianRupee } from 'lucide-react';

export default function AdminEmployees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionLoading, setActionLoading] = useState({});
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ salary: 0, TA: 0, DA: 0, allocatedArea: '' });
  const [updating, setUpdating] = useState(false);

  useEffect(() => { fetchEmployees(); }, [page, search]);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const { data } = await adminAPI.getEmployees({ page, limit: 15, search });
      setEmployees(data.employees || []);
      setTotal(data.total || 0);
    } catch { toast.error('Failed to load employees'); }
    finally { setLoading(false); }
  };

  const handleApprove = async (id, name) => {
    setActionLoading(p => ({ ...p, [id + '_approve']: true }));
    try {
      await adminAPI.approveEmployee(id);
      toast.success(`✅ ${name} approved`);
      fetchEmployees();
    } catch { toast.error('Failed'); }
    finally { setActionLoading(p => ({ ...p, [id + '_approve']: false })); }
  };

  const handleToggleBlock = async (id, name, isBlocked) => {
    setActionLoading(p => ({ ...p, [id + '_block']: true }));
    try {
      await adminAPI.toggleBlock(id);
      toast.success(`${isBlocked ? '✅ Unblocked' : '🚫 Blocked'} ${name}`);
      fetchEmployees();
    } catch { toast.error('Failed'); }
    finally { setActionLoading(p => ({ ...p, [id + '_block']: false })); }
  };

  const openEdit = (emp) => {
    setSelectedEmp(emp);
    setEditForm({
      salary: emp.salary || 0,
      TA: emp.TA || 0,
      DA: emp.DA || 0,
      allocatedArea: emp.allocatedArea || ''
    });
    setShowEditModal(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setUpdating(true);
    try {
      await adminAPI.updateEmployee(selectedEmp._id, editForm);
      toast.success('Employee updated');
      setShowEditModal(false);
      fetchEmployees();
    } catch { toast.error('Update failed'); }
    finally { setUpdating(false); }
  };

  const pendingCount = employees.filter(e => !e.isApproved).length;

  return (
    <AdminLayout>
      <div className="p-4 lg:p-6 space-y-6 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-[var(--text-main)] text-2xl font-black tracking-tight flex items-center gap-2">
               <Users className="w-6 h-6 text-primary-500" />
               Team Management
            </h1>
            <p className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-widest mt-1">Directory of {total} registered employees</p>
          </div>
          
          <div className="flex items-center gap-4">
            {pendingCount > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-500/10 border border-amber-500/20 shadow-lg shadow-amber-500/5">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span className="text-amber-500 text-xs font-black uppercase tracking-widest">{pendingCount} Pending</span>
              </div>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input 
                className="input-field pl-10 py-2.5 w-72 text-sm" 
                placeholder="Search team..." 
                value={search} 
                onChange={e => { setSearch(e.target.value); setPage(1); }} 
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="glass-card overflow-hidden border-[var(--border-color)] shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[var(--bg-main)] text-[var(--text-muted)] font-black uppercase tracking-widest text-[10px] border-b border-[var(--border-color)]">
                <tr>
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4">Department</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Connectivity</th>
                  <th className="px-6 py-4">Verification</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)] bg-[var(--bg-card)]">
                {loading ? (
                  [...Array(6)].map((_, i) => (
                    <tr key={i}><td colSpan={6} className="px-6 py-4"><div className="h-12 rounded-xl bg-white/5 animate-pulse" /></td></tr>
                  ))
                ) : employees.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-20 text-[var(--text-muted)] font-bold italic">No employees found in directory</td></tr>
                ) : employees.map(emp => (
                  <tr key={emp._id} className="hover:bg-[var(--bg-card-hover)] transition-all group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-primary-600/10 border border-primary-500/20 flex items-center justify-center text-primary-400 font-black text-lg shadow-inner group-hover:scale-105 transition-transform uppercase">
                          {emp.name?.[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[var(--text-main)] font-black text-sm tracking-tight group-hover:text-primary-400 transition-colors truncate">{emp.name}</p>
                          <p className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-widest truncate">{emp.employeeId || 'No ID'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-[var(--text-main)] text-xs font-bold">{emp.department || 'General'}</span>
                        <span className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-wider">{emp.designation || 'Staff'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {emp.isBlocked ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 text-red-500 text-[9px] font-black uppercase tracking-widest border border-red-500/20">
                           <span className="w-1 h-1 rounded-full bg-red-500" /> Blocked
                        </span>
                      ) : emp.isActive ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-[9px] font-black uppercase tracking-widest border border-emerald-500/20">
                           <span className="w-1 h-1 rounded-full bg-emerald-500" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-500/10 text-slate-500 text-[9px] font-black uppercase tracking-widest border border-slate-500/20">
                           <span className="w-1 h-1 rounded-full bg-slate-500" /> Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${emp.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
                          <span className={`text-[10px] font-black uppercase tracking-widest ${emp.isOnline ? 'text-emerald-500' : 'text-[var(--text-muted)]'}`}>
                            {emp.isOnline ? 'Live Now' : emp.lastSeen ? new Date(emp.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}
                          </span>
                        </div>
                        {emp.isTracking && (
                          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-violet-500/10 border border-violet-500/20 w-fit">
                             <Activity className="w-2.5 h-2.5 text-violet-400" />
                             <span className="text-violet-400 text-[8px] font-black uppercase">Tracking</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {emp.isApproved ? (
                        <div className="flex items-center gap-1.5 text-emerald-500 text-[10px] font-black uppercase tracking-widest">
                           <CheckCircle className="w-3.5 h-3.5" />
                           Approved
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-amber-500 text-[10px] font-black uppercase tracking-widest">
                           <Clock className="w-3.5 h-3.5" />
                           Pending
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!emp.isApproved && (
                          <button onClick={() => handleApprove(emp._id, emp.name)} disabled={actionLoading[emp._id + '_approve']}
                            className="w-9 h-9 rounded-xl bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white transition-all duration-300 flex items-center justify-center border border-emerald-500/20 disabled:opacity-50" title="Approve">
                            {actionLoading[emp._id + '_approve'] ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <UserCheck className="w-4.5 h-4.5" />}
                          </button>
                        )}
                        <button onClick={() => openEdit(emp)}
                          className="w-9 h-9 rounded-xl bg-primary-500/10 hover:bg-primary-500 text-primary-500 hover:text-white transition-all duration-300 flex items-center justify-center border border-primary-500/20"
                          title="Edit Details">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleToggleBlock(emp._id, emp.name, emp.isBlocked)} disabled={actionLoading[emp._id + '_block']}
                          className={`w-9 h-9 rounded-xl transition-all duration-300 flex items-center justify-center border disabled:opacity-50 ${emp.isBlocked ? 'bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 border-emerald-500/20 hover:text-white' : 'bg-red-500/10 hover:bg-red-500 text-red-500 border-red-500/20 hover:text-white'}`}
                          title={emp.isBlocked ? 'Unblock Account' : 'Block Account'}>
                          {actionLoading[emp._id + '_block'] ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : emp.isBlocked ? <ShieldOff className="w-4.5 h-4.5" /> : <Shield className="w-4.5 h-4.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {total > 15 && (
          <div className="flex items-center justify-center gap-6 py-4">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary px-6 py-2 text-xs font-black uppercase tracking-widest disabled:opacity-40 transition-all active:scale-95">Prev</button>
            <div className="flex items-center gap-2">
               <span className="text-primary-500 text-sm font-black">{page}</span>
               <span className="text-[var(--text-muted)] text-sm">/</span>
               <span className="text-[var(--text-muted)] text-sm font-bold">{Math.ceil(total / 15)}</span>
            </div>
            <button disabled={page * 15 >= total} onClick={() => setPage(p => p + 1)} className="btn-secondary px-6 py-2 text-xs font-black uppercase tracking-widest disabled:opacity-40 transition-all active:scale-95">Next</button>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="glass-card w-full max-w-lg p-6 shadow-2xl border-[var(--border-color)]">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-black text-[var(--text-main)] uppercase tracking-tight">Edit Employee Profile</h2>
                <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-white/5 rounded-xl"><X className="w-5 h-5 text-[var(--text-muted)]" /></button>
              </div>
              <form onSubmit={handleUpdate} className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-primary-500 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                    <MapPin className="w-3 h-3" /> Allocated Area
                  </label>
                  <input className="input-field" value={editForm.allocatedArea} onChange={e => setEditForm(p => ({ ...p, allocatedArea: e.target.value }))} placeholder="e.g. South Delhi, Zone 4" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                    <IndianRupee className="w-3 h-3" /> Monthly Salary
                  </label>
                  <input type="number" className="input-field" value={editForm.salary} onChange={e => setEditForm(p => ({ ...p, salary: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1.5">Travel Allowance (TA)</label>
                  <input type="number" className="input-field" value={editForm.TA} onChange={e => setEditForm(p => ({ ...p, TA: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-violet-500 uppercase tracking-widest mb-1.5">Daily Allowance (DA)</label>
                  <input type="number" className="input-field" value={editForm.DA} onChange={e => setEditForm(p => ({ ...p, DA: Number(e.target.value) }))} />
                </div>
                <div className="col-span-2 pt-4 flex gap-3">
                   <button type="button" onClick={() => setShowEditModal(false)} className="btn-secondary flex-1 py-3">Cancel</button>
                   <button type="submit" disabled={updating} className="btn-primary flex-1 py-3 flex items-center justify-center gap-2">
                      {updating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Save Changes'}
                   </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
