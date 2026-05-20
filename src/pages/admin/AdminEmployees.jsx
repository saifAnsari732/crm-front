import React, { useEffect, useState } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import { adminAPI } from '../../services/api.service';
import toast from 'react-hot-toast';
import {
  Search, Users, UserCheck, UserX, Shield, ShieldOff, CheckCircle, Clock,
  AlertTriangle, Activity, Edit2, X, MapPin, IndianRupee, Briefcase, User
} from 'lucide-react';

const DESIGNATIONS = ['ASM', 'SO', 'Sr SO', 'Jr SO', 'TSI', 'DSE'];

export default function AdminEmployees() {
  const [employees, setEmployees] = useState([]);
  const [managers, setManagers] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]); // for manager assignment
  const [assignedEmpIds, setAssignedEmpIds] = useState([]); // checkboxes
  const [empSearch, setEmpSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionLoading, setActionLoading] = useState({});
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    salary: 0, TA: 0, DA: 0, allocatedArea: '',
    address: { street: '', city: '', state: '', pincode: '' },
    designation: '', manager: '', role: 'employee'
  });
  const [updating, setUpdating] = useState(false);
  const [filterDesignation, setFilterDesignation] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [activeTab, setActiveTab] = useState('employees'); // 'employees' | 'managers'

  useEffect(() => { fetchAll(); }, [page, search, filterDesignation, filterStatus, activeTab]);

  // Fetch all employees for manager assignment checkboxes
  useEffect(() => {
    adminAPI.getEmployees({ limit: 500 }).then(({ data }) => setAllEmployees(data.employees || []));
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      if (activeTab === 'managers') {
        const { data } = await adminAPI.getManagers();
        setManagers(data.managers || []);
        setTotal(data.managers?.length || 0);
        setLoading(false);
        return;
      }
      const { data } = await adminAPI.getEmployees({ page, limit: 15, search });
      let filtered = data.employees || [];
      if (filterDesignation) filtered = filtered.filter(e => e.designation === filterDesignation);
      if (filterStatus === 'active') filtered = filtered.filter(e => e.isActive && !e.isBlocked);
      if (filterStatus === 'blocked') filtered = filtered.filter(e => e.isBlocked);
      if (filterStatus === 'pending') filtered = filtered.filter(e => !e.isApproved);
      setEmployees(filtered);
      setTotal(data.total || 0);

      // Always fetch managers list for dropdown
      const mgrRes = await adminAPI.getManagers();
      setManagers(mgrRes.data.managers || []);
    } catch { toast.error('Failed to load data'); }
    finally { setLoading(false); }
  };

  const handleApprove = async (id, name) => {
    setActionLoading(p => ({ ...p, [id + '_approve']: true }));
    try {
      await adminAPI.approveEmployee(id);
      toast.success(`✅ ${name} approved`);
      fetchAll();
    } catch { toast.error('Failed'); }
    finally { setActionLoading(p => ({ ...p, [id + '_approve']: false })); }
  };

  const handleToggleBlock = async (id, name, isBlocked) => {
    setActionLoading(p => ({ ...p, [id + '_block']: true }));
    try {
      await adminAPI.toggleBlock(id);
      toast.success(`${isBlocked ? '✅ Unblocked' : '🚫 Blocked'} ${name}`);
      fetchAll();
    } catch { toast.error('Failed'); }
    finally { setActionLoading(p => ({ ...p, [id + '_block']: false })); }
  };

  const openEdit = (emp) => {
    // Determine actual role — use activeTab as fallback if role field missing from API
    const actualRole = emp.role || (activeTab === 'managers' ? 'manager' : 'employee');
    setSelectedEmp({ ...emp, role: actualRole });
    setEditForm({
      salary: emp.salary || 0,
      TA: emp.TA || 0,
      DA: emp.DA || 0,
      allocatedArea: emp.allocatedArea || '',
      address: emp.address || { street: '', city: '', state: '', pincode: '' },
      designation: emp.designation || '',
      manager: emp.manager?._id || emp.manager || '',
      role: actualRole
    });
    setEmpSearch('');
    // If editing a manager, pre-select employees already assigned to them
    if (actualRole === 'manager') {
      const alreadyAssigned = allEmployees
        .filter(e => {
          const mgrId = e.manager?._id || e.manager;
          return mgrId && mgrId.toString() === emp._id.toString();
        })
        .map(e => e._id);
      setAssignedEmpIds(alreadyAssigned);
    } else {
      setAssignedEmpIds([]);
    }
    setShowEditModal(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setUpdating(true);
    try {
      await adminAPI.updateEmployee(selectedEmp._id, editForm);

      // If editing a manager, also update all employee-manager assignments
      if (selectedEmp.role === 'manager' || editForm.role === 'manager') {
        const managerId = selectedEmp._id;
        // Find employees previously assigned to this manager
        const prevAssigned = allEmployees
          .filter(e => {
            const mgrId = e.manager?._id || e.manager;
            return mgrId && mgrId.toString() === managerId.toString();
          })
          .map(e => e._id.toString());

        const toAssign = assignedEmpIds.filter(id => !prevAssigned.includes(id.toString()));
        const toUnassign = prevAssigned.filter(id => !assignedEmpIds.map(i => i.toString()).includes(id));

        await Promise.all([
          ...toAssign.map(id => adminAPI.updateEmployee(id, { manager: managerId })),
          ...toUnassign.map(id => adminAPI.updateEmployee(id, { manager: null })),
        ]);

        if (toAssign.length > 0 || toUnassign.length > 0) {
          toast.success(`✅ ${toAssign.length} assigned, ${toUnassign.length} unassigned`);
        }
        // Refresh allEmployees cache
        const { data } = await adminAPI.getEmployees({ limit: 500 });
        setAllEmployees(data.employees || []);
      }

      toast.success('✅ Profile updated successfully');
      setShowEditModal(false);
      fetchAll();
    } catch { toast.error('Update failed'); }
    finally { setUpdating(false); }
  };

  const pendingCount = employees.filter(e => !e.isApproved).length;

  // Rows to display based on active tab
  const rows = activeTab === 'managers' ? managers : employees;

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
            <p className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-widest mt-1">
              Directory of {total} {activeTab === 'managers' ? 'managers' : 'registered employees'}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap justify-end">
            {pendingCount > 0 && activeTab === 'employees' && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span className="text-amber-500 text-xs font-black uppercase tracking-widest">{pendingCount} Pending</span>
              </div>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input
                className="input-field pl-10 py-2.5 w-44 text-sm"
                placeholder="Search..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            {activeTab === 'employees' && (
              <>
                <select className="input-field py-2.5 w-32 text-sm" value={filterDesignation} onChange={e => setFilterDesignation(e.target.value)}>
                  <option value="">All Roles</option>
                  {DESIGNATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <select className="input-field py-2.5 w-32 text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                  <option value="">All Status</option>
                  <option value="active">Active</option>
                  <option value="blocked">Blocked</option>
                  <option value="pending">Pending</option>
                </select>
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 bg-[var(--bg-card)] p-1.5 rounded-2xl border border-[var(--border-color)] w-fit">
          {[
            { key: 'employees', label: 'Employees', icon: Users },
            { key: 'managers', label: 'Managers (ASM/SO)', icon: Briefcase }
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => { setActiveTab(key); setPage(1); }}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === key
                  ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/20'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-white/5'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="glass-card overflow-hidden border-[var(--border-color)] shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[var(--bg-main)] text-[var(--text-muted)] font-black uppercase tracking-widest text-[10px] border-b border-[var(--border-color)]">
                <tr>
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4">Dept / Designation</th>
                  {activeTab === 'employees' && <th className="px-6 py-4">Manager</th>}
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Online</th>
                  {activeTab === 'employees' && <th className="px-6 py-4">Verified</th>}
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)] bg-[var(--bg-card)]">
                {loading ? (
                  [...Array(6)].map((_, i) => (
                    <tr key={i}><td colSpan={7} className="px-6 py-4"><div className="h-12 rounded-xl bg-white/5 animate-pulse" /></td></tr>
                  ))
                ) : rows.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-20 text-[var(--text-muted)] font-bold italic">No {activeTab} found</td></tr>
                ) : rows.map(emp => (
                  <tr key={emp._id} className="hover:bg-[var(--bg-card-hover)] transition-all group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-lg shadow-inner group-hover:scale-105 transition-transform uppercase ${
                          activeTab === 'managers' ? 'bg-blue-600/10 border border-blue-500/20 text-blue-400' : 'bg-primary-600/10 border border-primary-500/20 text-primary-400'
                        }`}>
                          {emp.name?.[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[var(--text-main)] font-black text-sm tracking-tight group-hover:text-primary-400 transition-colors truncate">{emp.name}</p>
                          <p className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-widest truncate">{emp.employeeId || 'No ID'}</p>
                          <p className="text-[var(--text-muted)] text-[10px] truncate">{emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-[var(--text-main)] text-xs font-bold">{emp.department || 'General'}</span>
                        <span className={`text-[10px] font-black uppercase tracking-wider ${activeTab === 'managers' ? 'text-blue-400' : 'text-primary-400'}`}>
                          {emp.designation || 'Staff'}
                        </span>
                        {emp.address?.city && (
                          <span className="text-[var(--text-muted)] text-[10px] flex items-center gap-1 mt-0.5">
                            <MapPin className="w-2.5 h-2.5" />{emp.address.city}
                          </span>
                        )}
                      </div>
                    </td>
                    {activeTab === 'employees' && (
                      <td className="px-6 py-4">
                        {emp.manager ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-6 h-6 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 text-[10px] font-black uppercase">
                              {typeof emp.manager === 'object' ? emp.manager.name?.[0] : '?'}
                            </div>
                            <span className="text-[var(--text-muted)] text-[10px] font-bold">
                              {typeof emp.manager === 'object' ? emp.manager.name : 'Assigned'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[var(--text-muted)] text-[10px] opacity-50">—</span>
                        )}
                      </td>
                    )}
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
                            {emp.isOnline ? 'Live' : 'Offline'}
                          </span>
                        </div>
                        {emp.isTracking && (
                          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-violet-500/10 border border-violet-500/20 w-fit">
                            <Activity className="w-2.5 h-2.5 text-violet-400" />
                            <span className="text-violet-400 text-[8px] font-black uppercase">Tracking</span>
                          </div>
                        )}
                      </div>
                    </td>
                    {activeTab === 'employees' && (
                      <td className="px-6 py-4">
                        {emp.isApproved ? (
                          <div className="flex items-center gap-1.5 text-emerald-500 text-[10px] font-black uppercase tracking-widest">
                            <CheckCircle className="w-3.5 h-3.5" /> Approved
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-amber-500 text-[10px] font-black uppercase tracking-widest">
                            <Clock className="w-3.5 h-3.5" /> Pending
                          </div>
                        )}
                      </td>
                    )}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {activeTab === 'employees' && !emp.isApproved && (
                          <button onClick={() => handleApprove(emp._id, emp.name)} disabled={actionLoading[emp._id + '_approve']}
                            className="w-9 h-9 rounded-xl bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white transition-all duration-300 flex items-center justify-center border border-emerald-500/20 disabled:opacity-50" title="Approve">
                            {actionLoading[emp._id + '_approve'] ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <UserCheck className="w-4 h-4" />}
                          </button>
                        )}
                        <button onClick={() => openEdit(emp)}
                          className="w-9 h-9 rounded-xl bg-primary-500/10 hover:bg-primary-500 text-primary-500 hover:text-white transition-all duration-300 flex items-center justify-center border border-primary-500/20"
                          title="Edit Details">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleToggleBlock(emp._id, emp.name, emp.isBlocked)} disabled={actionLoading[emp._id + '_block']}
                          className={`w-9 h-9 rounded-xl transition-all duration-300 flex items-center justify-center border disabled:opacity-50 ${emp.isBlocked ? 'bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 border-emerald-500/20 hover:text-white' : 'bg-red-500/10 hover:bg-red-500 text-red-500 border-red-500/20 hover:text-white'}`}
                          title={emp.isBlocked ? 'Unblock' : 'Block'}>
                          {actionLoading[emp._id + '_block'] ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : emp.isBlocked ? <ShieldOff className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
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
        {activeTab === 'employees' && total > 15 && (
          <div className="flex items-center justify-center gap-6 py-4">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary px-6 py-2 text-xs font-black uppercase tracking-widest disabled:opacity-40">Prev</button>
            <div className="flex items-center gap-2">
              <span className="text-primary-500 text-sm font-black">{page}</span>
              <span className="text-[var(--text-muted)] text-sm">/</span>
              <span className="text-[var(--text-muted)] text-sm font-bold">{Math.ceil(total / 15)}</span>
            </div>
            <button disabled={page * 15 >= total} onClick={() => setPage(p => p + 1)} className="btn-secondary px-6 py-2 text-xs font-black uppercase tracking-widest disabled:opacity-40">Next</button>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="glass-card w-full max-w-2xl shadow-2xl border-[var(--border-color)] flex flex-col max-h-[90vh]">

              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-[var(--border-color)]">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl uppercase ${
                    editForm.role === 'manager' ? 'bg-blue-600/10 border border-blue-500/20 text-blue-400' : 'bg-primary-600/10 border border-primary-500/20 text-primary-400'
                  }`}>
                    {selectedEmp?.name?.[0]}
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-[var(--text-main)] tracking-tight">{selectedEmp?.name}</h2>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                        editForm.role === 'manager' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : 'bg-primary-500/10 text-primary-500 border-primary-500/20'
                      }`}>{editForm.role}</span>
                      <span className="text-[var(--text-muted)] text-[10px]">{selectedEmp?.employeeId}</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
                  <X className="w-5 h-5 text-[var(--text-muted)]" />
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="overflow-y-auto flex-1 p-6">
                <form id="edit-form" onSubmit={handleUpdate} className="space-y-5">

                  {/* Role & Designation */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-primary-500 uppercase tracking-widest mb-1.5">Role</label>
                      <select className="input-field" value={editForm.role} onChange={e => setEditForm(p => ({ ...p, role: e.target.value }))}>
                        <option value="employee">Employee</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                        <option value="hr">HR</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-primary-500 uppercase tracking-widest mb-1.5">Designation</label>
                      <select className="input-field" value={editForm.designation} onChange={e => setEditForm(p => ({ ...p, designation: e.target.value }))}>
                        <option value="">Select Designation</option>
                        {DESIGNATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* === IF MANAGER: Show Employee Assignment === */}
                  {(editForm.role === 'manager' || selectedEmp?.role === 'manager') ? (
                    <div className="border border-blue-500/20 rounded-2xl overflow-hidden bg-blue-500/5">
                      <div className="flex items-center justify-between px-4 py-3 bg-blue-500/10 border-b border-blue-500/20">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-blue-400" />
                          <span className="text-blue-400 text-[10px] font-black uppercase tracking-widest">Assign Employees to this Manager</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-black">
                          {assignedEmpIds.length} Selected
                        </span>
                      </div>

                      {/* Search employees */}
                      <div className="p-3 border-b border-blue-500/10">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
                          <input
                            className="input-field pl-9 py-2 text-sm w-full"
                            placeholder="Search employee by name..."
                            value={empSearch}
                            onChange={e => setEmpSearch(e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Employee list with checkboxes */}
                      <div className="max-h-56 overflow-y-auto divide-y divide-[var(--border-color)]">
                        {allEmployees
                          .filter(e => e.role === 'employee' || e.role === 'hr')
                          .filter(e => !empSearch || e.name?.toLowerCase().includes(empSearch.toLowerCase()) || e.employeeId?.toLowerCase().includes(empSearch.toLowerCase()))
                          .map(emp => {
                            const isChecked = assignedEmpIds.some(id => id.toString() === emp._id.toString());
                            return (
                              <label key={emp._id} className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-blue-500/5 ${isChecked ? 'bg-blue-500/10' : ''}`}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    setAssignedEmpIds(prev =>
                                      isChecked
                                        ? prev.filter(id => id.toString() !== emp._id.toString())
                                        : [...prev, emp._id]
                                    );
                                  }}
                                  className="w-4 h-4 rounded accent-blue-500"
                                />
                                <div className="w-8 h-8 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-muted)] font-black text-sm uppercase">
                                  {emp.name?.[0]}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-black truncate ${isChecked ? 'text-blue-400' : 'text-[var(--text-main)]'}`}>{emp.name}</p>
                                  <p className="text-[var(--text-muted)] text-[10px] font-bold uppercase">{emp.designation || 'Staff'} • {emp.employeeId}</p>
                                </div>
                                {isChecked && (
                                  <span className="text-blue-400 text-[10px] font-black uppercase tracking-widest flex-shrink-0">✓ Assigned</span>
                                )}
                              </label>
                            );
                          })}
                        {allEmployees.filter(e => e.role === 'employee' || e.role === 'hr').length === 0 && (
                          <p className="text-center text-[var(--text-muted)] py-8 text-sm italic">No employees found</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* === IF EMPLOYEE: Show Assign Manager === */
                    <div>
                      <label className="block text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                        <Briefcase className="w-3 h-3" /> Assign to Manager
                      </label>
                      <select className="input-field" value={editForm.manager} onChange={e => setEditForm(p => ({ ...p, manager: e.target.value }))}>
                        <option value="">— No Manager —</option>
                        {managers.map(m => (
                          <option key={m._id} value={m._id}>{m.name} ({m.designation || 'Manager'})</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Area */}
                  <div>
                    <label className="block text-[10px] font-black text-primary-500 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                      <MapPin className="w-3 h-3" /> Allocated Area
                    </label>
                    <input className="input-field" value={editForm.allocatedArea} onChange={e => setEditForm(p => ({ ...p, allocatedArea: e.target.value }))} placeholder="e.g. Lucknow, Zone 4" />
                  </div>

                  {/* Salary & TA */}
                  <div className="grid grid-cols-2 gap-4">
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
                  </div>

                  {/* Address */}
                  <div className="border-t border-[var(--border-color)] pt-4">
                    <label className="block text-[10px] font-black text-primary-500 uppercase tracking-widest mb-3">Full Address</label>
                    <div className="grid grid-cols-2 gap-3">
                      <input className="input-field col-span-2" placeholder="Street / Mohalla / Colony" value={editForm.address.street} onChange={e => setEditForm(p => ({ ...p, address: { ...p.address, street: e.target.value } }))} />
                      <input className="input-field" placeholder="City" value={editForm.address.city} onChange={e => setEditForm(p => ({ ...p, address: { ...p.address, city: e.target.value } }))} />
                      <input className="input-field" placeholder="State" value={editForm.address.state} onChange={e => setEditForm(p => ({ ...p, address: { ...p.address, state: e.target.value } }))} />
                      <input className="input-field col-span-2" placeholder="Pincode" value={editForm.address.pincode} onChange={e => setEditForm(p => ({ ...p, address: { ...p.address, pincode: e.target.value } }))} />
                    </div>
                  </div>
                </form>
              </div>

              {/* Footer Buttons */}
              <div className="p-6 border-t border-[var(--border-color)] flex gap-3">
                <button type="button" onClick={() => setShowEditModal(false)} className="btn-secondary flex-1 py-3 text-sm font-black uppercase tracking-widest">Cancel</button>
                <button type="submit" form="edit-form" disabled={updating} className="btn-primary flex-1 py-3 text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2">
                  {updating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : `Save Changes${assignedEmpIds.length > 0 && (editForm.role === 'manager' || selectedEmp?.role === 'manager') ? ` (${assignedEmpIds.length} emp)` : ''}`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

