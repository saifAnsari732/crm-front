import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TrackProLayout from '../../components/layout/TrackProLayout';
import { useAuth } from '../../contexts/AuthContext';
import {
  Users,
  UserCheck,
  UserX,
  Building2,
  Users2,
  Search,
  Filter,
  Plus,
  Download,
  Upload,
  MoreVertical,
  CheckCircle2,
  XCircle,
  MapPin,
  Clock,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Eye,
  Trash2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  X,
  Phone,
  Mail,
  AlertTriangle,
  AlertCircle,
  Briefcase,
  Navigation,
  Calendar,
  DollarSign,
  Loader2,
  Home,
  User,
  CreditCard,
} from 'lucide-react';
import { API } from '../../services/api.service';
import toast from 'react-hot-toast';
import Avatar from '../../components/shared/Avatar';

export default function AdminEmployees() {
  const { user, organization } = useAuth();
  const navigate = useNavigate();

  const userRole = (user?.role || '').toUpperCase();
  const isSuperAdmin = userRole === 'SUPER_ADMIN' || userRole === 'SUPERADMIN';
  
  // Plan verification: true if active and not expired
  const isPlanActive = isSuperAdmin || (
    organization?.status === 'active' &&
    Boolean(organization?.plan?.expiresAt) &&
    new Date(organization.plan.expiresAt) > new Date()
  );

  const [livePlanLimits, setLivePlanLimits] = useState({
    maxEmployees: organization?.plan?.maxEmployees || 10,
    maxManagers: organization?.plan?.maxManagers || 3,
  });

  useEffect(() => {
    const fetchOrgPlan = async () => {
      try {
        const [orgRes, plansRes] = await Promise.all([
          API.get('/admin/organization').catch(() => null),
          API.get('/payment/plans').catch(() => null),
        ]);

        const orgData = orgRes?.data?.organization || organization;
        const plans = plansRes?.data?.plans || [];

        if (orgData?.plan?.planName && plans.length > 0) {
          const matchingPlan = plans.find(
            (p) =>
              p.planId === orgData.plan.planId ||
              p.name.toLowerCase() === orgData.plan.planName.toLowerCase() ||
              (orgData.plan.planName.toLowerCase().includes('starter') && p.planId === 'starter') ||
              (orgData.plan.planName.toLowerCase().includes('pro') && p.planId === 'pro') ||
              (orgData.plan.planName.toLowerCase().includes('enterprise') && p.planId === 'enterprise')
          );
          if (matchingPlan) {
            setLivePlanLimits({
              maxEmployees: matchingPlan.maxEmployees || orgData.plan?.maxEmployees || 10,
              maxManagers: matchingPlan.maxManagers || orgData.plan?.maxManagers || 3,
            });
          }
        }
      } catch (err) {
        // Fallback to org limits
      }
    };
    fetchOrgPlan();
  }, [organization]);

  const maxEmployees = isSuperAdmin ? 9999 : (livePlanLimits.maxEmployees || organization?.plan?.maxEmployees || 10);

  const [employees, setEmployees] = useState([]);
  const [managersList, setManagersList] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [mgrFilter, setMgrFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // View Details & Actions State
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [empDetailsLoading, setEmpDetailsLoading] = useState(false);
  const [empStats, setEmpStats] = useState(null);
  const [empToDelete, setEmpToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [blockingId, setBlockingId] = useState(null);

  // Bulk & Quick Manager Assign State
  const [bulkManagerId, setBulkManagerId] = useState('');
  const [assigningBulk, setAssigningBulk] = useState(false);
  const [editingManagerEmpId, setEditingManagerEmpId] = useState(null);
  const [quickManagerId, setQuickManagerId] = useState('');
  const [updatingEmpManager, setUpdatingEmpManager] = useState(false);

  // New Employee Form State
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    department: 'Field Services',
    designation: 'Field Executive',
    managerId: '',
    password: '',
    salary: 15000,
    TA: 2.5,
  });

  const handleBulkAssignManager = async () => {
    if (!bulkManagerId) {
      toast.error('Please select a manager from the list');
      return;
    }
    if (selectedIds.length === 0) {
      toast.error('Please select at least one employee');
      return;
    }

    try {
      setAssigningBulk(true);
      const res = await API.post('/employees/assign-manager', {
        employeeIds: selectedIds,
        managerId: bulkManagerId,
      });

      if (res.data?.success) {
        const mgrObj = managersList.find((m) => m._id === bulkManagerId);
        toast.success(`🎉 Assigned ${selectedIds.length} employee(s) to ${mgrObj?.name || 'Manager'}!`);
        setSelectedIds([]);
        setBulkManagerId('');
        fetchEmployeesData();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to assign manager');
    } finally {
      setAssigningBulk(false);
    }
  };

  const handleQuickAssignManager = async (employeeId, managerId) => {
    try {
      setUpdatingEmpManager(true);
      const res = await API.put(`/employees/${employeeId}`, {
        managerId: managerId || null,
        manager: managerId || null,
      });

      if (res.data?.success) {
        const mgrObj = managersList.find((m) => m._id === managerId);
        toast.success(`Updated manager to ${mgrObj?.name || 'Unassigned'}`);
        setEditingManagerEmpId(null);
        if (selectedEmp && selectedEmp._id === employeeId) {
          setSelectedEmp((prev) => ({
            ...prev,
            manager: mgrObj || null,
            managerId: managerId || null,
          }));
        }
        fetchEmployeesData();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update employee manager');
    } finally {
      setUpdatingEmpManager(false);
    }
  };

  const fetchEmployeesData = async () => {
    try {
      setLoading(true);
      const [empRes, mgrRes] = await Promise.all([
        API.get('/employees').catch(() => ({ data: { success: false } })),
        API.get('/admin/managers').catch(() => ({ data: { success: false } })),
      ]);

      if (empRes.data?.success && Array.isArray(empRes.data.employees)) {
        setEmployees(empRes.data.employees);
      }
      if (mgrRes.data?.success && Array.isArray(mgrRes.data.managers)) {
        setManagersList(mgrRes.data.managers);
      }
    } catch (e) {
      console.error('Error fetching employees:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployeesData();
  }, []);

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(filteredEmployees.map((emp) => emp._id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleOpenAddModal = () => {
    if (!isPlanActive) {
      toast.error('❌ Active Subscription Plan Required! Please activate your plan in Billing to add employees.', {
        id: 'plan-check-add-emp',
        duration: 5000,
      });
      navigate('/admin/billing');
      return;
    }

    if (employees.length >= maxEmployees) {
      toast.error(`⚠️ Employee Quota Full (${employees.length}/${maxEmployees} Seats Used)! Your current plan limit is reached. Please upgrade your plan in Billing to add more staff.`, {
        id: 'quota-full-emp',
        duration: 6000,
      });
      navigate('/admin/billing');
      return;
    }

    setShowAddModal(true);
  };

  const handleImportEmployees = () => {
    if (!isPlanActive) {
      toast.error('❌ Subscription Plan Not Active! Billing enable first to import employees.', {
        id: 'plan-check-import-emp',
        duration: 5000,
      });
      navigate('/admin/billing');
      return;
    }
    toast.success('CSV Template exported');
  };

  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    if (!isPlanActive) {
      toast.error('❌ Active Subscription Plan Required! Please activate a plan in Billing.');
      navigate('/admin/billing');
      return;
    }

    if (employees.length >= maxEmployees) {
      toast.error(`⚠️ Employee Quota Full (${employees.length}/${maxEmployees} Seats Used)! Please upgrade your plan in Billing.`);
      navigate('/admin/billing');
      return;
    }

    try {
      const res = await API.post('/employees', formData);

      if (res.data?.success) {
        toast.success(`🎉 Employee "${formData.name}" added successfully!`);
        setShowAddModal(false);
        setFormData({
          name: '',
          phone: '',
          email: '',
          department: 'Field Services',
          designation: 'Field Executive',
          managerId: '',
          password: '',
          salary: 15000,
          TA: 2.5,
        });
        fetchEmployeesData();
      }
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to add employee';
      toast.error(msg, { duration: 6000 });
      if (error.response?.data?.limitReached) {
        setTimeout(() => navigate('/admin/billing'), 1500);
      }
    }
  };

  const handleViewEmployee = async (emp) => {
    setSelectedEmp(emp);
    setEmpDetailsLoading(true);
    setEmpStats(null);
    try {
      const res = await API.get(`/employees/${emp._id}`);
      if (res.data?.success && res.data.employee) {
        setSelectedEmp(res.data.employee);
        if (res.data.stats) setEmpStats(res.data.stats);
      }
    } catch (err) {
      console.warn('Failed to load employee details:', err);
    } finally {
      setEmpDetailsLoading(false);
    }
  };

  const handleToggleBlock = async (emp) => {
    try {
      setBlockingId(emp._id);
      const res = await API.put(`/employees/${emp._id}/block`);
      if (res.data?.success) {
        toast.success(res.data.message);
        setEmployees((prev) =>
          prev.map((e) =>
            e._id === emp._id
              ? { ...e, isBlocked: res.data.isBlocked, isActive: res.data.isActive }
              : e
          )
        );
        if (selectedEmp && selectedEmp._id === emp._id) {
          setSelectedEmp((prev) => ({
            ...prev,
            isBlocked: res.data.isBlocked,
            isActive: res.data.isActive,
          }));
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update employee block status');
    } finally {
      setBlockingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!empToDelete) return;
    try {
      setDeleting(true);
      const res = await API.delete(`/employees/${empToDelete._id}`);
      if (res.data?.success) {
        toast.success(`🗑️ ${res.data.message}`);
        setEmployees((prev) => prev.filter((e) => e._id !== empToDelete._id));
        if (selectedEmp && selectedEmp._id === empToDelete._id) {
          setSelectedEmp(null);
        }
        setEmpToDelete(null);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete employee and associated records');
    } finally {
      setDeleting(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setDeptFilter('all');
    setMgrFilter('all');
    setStatusFilter('all');
  };

  // Distinct departments and managers from loaded data
  const distinctDepts = Array.from(new Set(employees.map((e) => e.department).filter(Boolean)));
  const distinctManagers = Array.from(new Set(employees.map((e) => e.manager?.name || e.managerName).filter(Boolean)));

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employeeId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.phone?.includes(searchTerm) ||
      emp.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = deptFilter === 'all' || emp.department === deptFilter;
    const matchesMgr = mgrFilter === 'all' || (emp.manager?.name === mgrFilter || emp.managerName === mgrFilter);
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'Active' && emp.isActive !== false) ||
      (statusFilter === 'Inactive' && emp.isActive === false);
    return matchesSearch && matchesDept && matchesMgr && matchesStatus;
  });

  const activeEmployeesCount = employees.filter((e) => e.isActive !== false).length;
  const inactiveEmployeesCount = employees.filter((e) => e.isActive === false).length;
  const onlineCount = employees.filter((e) => e.isOnline).length;

  return (
    <TrackProLayout>
      <div className="space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Employees</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Manage your organization's employees, assign managers and track performance.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleImportEmployees}
              className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200 shadow-xs transition"
            >
              <Upload className="w-4 h-4 text-slate-500" /> Import Employees
            </button>

            <button
              onClick={handleOpenAddModal}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-sm transition active:scale-95"
            >
              <Plus className="w-4 h-4" /> Add Employee
            </button>
          </div>
        </div>

        {/* 6 TrackPro KPI Cards (Dynamically Computed from DB) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold mb-2">
              <Users className="w-4 h-4" />
            </div>
            <p className="text-[11px] font-medium text-slate-500">Total Employees</p>
            <h3 className="text-xl font-bold text-slate-900 mt-0.5">{employees.length}</h3>
            <span className="text-[10px] font-semibold text-emerald-600 mt-0.5 block">Live from DB</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold mb-2">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <p className="text-[11px] font-medium text-slate-500">Active Employees</p>
            <h3 className="text-xl font-bold text-slate-900 mt-0.5">{activeEmployeesCount}</h3>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              {employees.length > 0 ? ((activeEmployeesCount / employees.length) * 100).toFixed(0) : 0}% of total
            </span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold mb-2">
              <UserX className="w-4 h-4" />
            </div>
            <p className="text-[11px] font-medium text-slate-500">Inactive Employees</p>
            <h3 className="text-xl font-bold text-slate-900 mt-0.5">{inactiveEmployeesCount}</h3>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Deactivated</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold mb-2">
              <UserCheck className="w-4 h-4" />
            </div>
            <p className="text-[11px] font-medium text-slate-500">Total Managers</p>
            <h3 className="text-xl font-bold text-slate-900 mt-0.5">{managersList.length}</h3>
            <span className="text-[10px] font-semibold text-indigo-600 mt-0.5 block">Active Leads</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold mb-2">
              <Building2 className="w-4 h-4" />
            </div>
            <p className="text-[11px] font-medium text-slate-500">Departments</p>
            <h3 className="text-xl font-bold text-slate-900 mt-0.5">{distinctDepts.length || 1}</h3>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Configured</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center font-bold mb-2">
              <Users2 className="w-4 h-4" />
            </div>
            <p className="text-[11px] font-medium text-slate-500">Online Now</p>
            <h3 className="text-xl font-bold text-slate-900 mt-0.5">{onlineCount}</h3>
            <span className="text-[10px] text-emerald-600 font-semibold mt-0.5 block">Connected</span>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-[280px]">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search by name, ID, phone, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none"
            >
              <option value="all">All Departments</option>
              {distinctDepts.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            <select
              value={mgrFilter}
              onChange={(e) => setMgrFilter(e.target.value)}
              className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none"
            >
              <option value="all">All Managers</option>
              {distinctManagers.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none"
            >
              <option value="all">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Clear Filters
            </button>
          </div>
        </div>

        {/* Employees Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4 w-10">
                    <input
                      type="checkbox"
                      onChange={handleSelectAll}
                      checked={selectedIds.length === filteredEmployees.length && filteredEmployees.length > 0}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Employee ID</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Manager</th>
                  <th className="py-3 px-4">Designation</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Tracking State</th>
                  <th className="py-3 px-4">Allocated Area</th>
                  <th className="py-3 px-4">Last Active</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredEmployees.length > 0 ? (
                  filteredEmployees.map((emp) => (
                    <tr key={emp._id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3.5 px-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(emp._id)}
                          onChange={() => handleSelectOne(emp._id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>

                      {/* Employee Avatar + Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <Avatar
                            src={emp.avatar}
                            name={emp.name}
                            size="md"
                            status={emp.isOnline ? 'online' : emp.isActive === false ? 'offline' : undefined}
                          />
                          <div>
                            <span className="font-bold text-slate-900 block leading-tight">{emp.name}</span>
                            <span className="text-[11px] text-slate-500 block">{emp.phone}</span>
                            <span className="text-[10px] text-slate-400 block">{emp.email}</span>
                          </div>
                        </div>
                      </td>

                      {/* Employee ID */}
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-600">
                        {emp.employeeId || 'EMP-' + emp._id.slice(-6).toUpperCase()}
                      </td>

                      {/* Department Badge */}
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          {emp.department || 'Field Services'}
                        </span>
                      </td>

                      {/* Manager */}
                      <td className="py-3.5 px-4">
                        {editingManagerEmpId === emp._id ? (
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <select
                              defaultValue={emp.manager?._id || emp.managerId || emp.manager || ''}
                              onChange={(e) => handleQuickAssignManager(emp._id, e.target.value)}
                              disabled={updatingEmpManager}
                              className="p-1 text-[11px] font-semibold bg-white border border-blue-500 rounded-lg focus:outline-none shadow-sm"
                            >
                              <option value="">No Manager</option>
                              {managersList.map((m) => (
                                <option key={m._id} value={m._id}>
                                  {m.name}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => setEditingManagerEmpId(null)}
                              className="p-1 text-slate-400 hover:text-slate-600 rounded"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => setEditingManagerEmpId(emp._id)}
                            className="group/mgr flex items-center gap-2 cursor-pointer hover:bg-slate-100 p-1.5 rounded-xl transition-all"
                            title="Click to assign or change manager"
                          >
                            <Avatar
                              src={emp.manager?.avatar}
                              name={emp.manager?.name || emp.managerName || 'Unassigned'}
                              size="xs"
                            />
                            <div>
                              <span className="font-semibold text-slate-900 block leading-tight group-hover/mgr:text-blue-600">
                                {emp.manager?.name || emp.managerName || 'Assign Manager'}
                              </span>
                              <span className="text-[10px] text-slate-400 block">
                                {emp.manager?.department || (emp.manager ? 'Manager' : 'Click to assign')}
                              </span>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Designation */}
                      <td className="py-3.5 px-4 text-slate-600 font-medium">{emp.designation || 'Field Executive'}</td>

                      {/* Status Active / Inactive / Blocked */}
                      <td className="py-3.5 px-4">
                        {emp.isBlocked ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold text-[11px] bg-rose-50 text-rose-700 border border-rose-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span> Blocked
                          </span>
                        ) : emp.isActive === false ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-semibold text-[11px] bg-slate-100 text-slate-600 border border-slate-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Inactive
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-semibold text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active
                          </span>
                        )}
                      </td>

                      {/* Tracking State */}
                      <td className="py-3.5 px-4">
                        {emp.isOnline ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Online
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-slate-400 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span> Offline
                          </span>
                        )}
                      </td>

                      {/* Allocated Area */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-start gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
                          <span className="font-semibold text-slate-800">{emp.allocatedArea || 'Lucknow Zone'}</span>
                        </div>
                      </td>

                      {/* Last Active */}
                      <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                        {emp.lastSeen ? new Date(emp.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleViewEmployee(emp)}
                            title="View Employee Details"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View
                          </button>

                          <button
                            onClick={() => handleToggleBlock(emp)}
                            disabled={blockingId === emp._id}
                            title={emp.isBlocked ? 'Unblock Employee Account' : 'Block Employee Account'}
                            className={`p-1.5 text-[11px] rounded-lg border transition ${
                              emp.isBlocked
                                ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'
                                : 'text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-200'
                            }`}
                          >
                            {blockingId === emp._id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : emp.isBlocked ? (
                              <ShieldCheck className="w-3.5 h-3.5" />
                            ) : (
                              <ShieldAlert className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <button
                            onClick={() => setEmpToDelete(emp)}
                            title="Delete Employee & Cascade All Data"
                            className="p-1.5 text-[11px] font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 hover:text-rose-700 border border-rose-200 rounded-lg transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="11" className="py-12 text-center text-xs text-slate-400">
                      {loading ? 'Loading employees from database...' : 'No employees found in this organization.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Showing {filteredEmployees.length} of {employees.length} employees</span>
          </div>
        </div>

        {/* Add Employee Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 border border-slate-200">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Add New Employee</h3>
                  <p className="text-xs text-slate-500">Create login credentials and assign to a Manager.</p>
                </div>
                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>

              <form onSubmit={handleCreateEmployee} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Kumar"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                    <input
                      type="text"
                      required
                      placeholder="+91 9876543210"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      placeholder="ramesh@company.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Temporary Password</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Department</label>
                    <input
                      type="text"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Assign Manager</label>
                    <select
                      value={formData.managerId}
                      onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
                      className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">No Manager (Unassigned)</option>
                      {managersList.map((m) => (
                        <option key={m._id} value={m._id}>{m.name} ({m.department})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 shadow-sm"
                  >
                    Create Account & Login ID
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 1. VIEW EMPLOYEE DETAILS MODAL                                            */}
        {/* ========================================================================= */}
        {selectedEmp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="p-6 bg-gradient-to-r from-slate-900 to-slate-800 text-white relative flex-shrink-0">
                <button
                  onClick={() => setSelectedEmp(null)}
                  className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-4">
                  <Avatar
                    src={selectedEmp.avatar}
                    name={selectedEmp.name}
                    size="2xl"
                    shape="rounded-2xl"
                  />

                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold">{selectedEmp.name}</h2>
                      {selectedEmp.isBlocked ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                          BLOCKED
                        </span>
                      ) : selectedEmp.isActive === false ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-500/30 text-slate-300 border border-slate-500/40">
                          INACTIVE
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> ACTIVE
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-300 mt-0.5 flex items-center gap-2">
                      <span>{selectedEmp.designation || 'Field Executive'}</span>
                      <span>•</span>
                      <span className="font-mono text-blue-300">{selectedEmp.employeeId || 'EMP-' + selectedEmp._id?.slice(-6).toUpperCase()}</span>
                      <span>•</span>
                      <span className="capitalize">{selectedEmp.role || 'Employee'}</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-700 text-xs">
                {empDetailsLoading ? (
                  <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                    <span>Loading employee profile & telemetry records...</span>
                  </div>
                ) : (
                  <>
                    {/* Performance & Tracking KPI Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3.5 bg-blue-50/60 rounded-2xl border border-blue-100">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-blue-600 block mb-1">
                          Tracked Distance
                        </span>
                        <span className="text-lg font-black text-slate-900">
                          {empStats?.totalKm !== undefined ? empStats.totalKm : 0} <span className="text-xs font-semibold text-slate-500">km</span>
                        </span>
                      </div>

                      <div className="p-3.5 bg-emerald-50/60 rounded-2xl border border-emerald-100">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 block mb-1">
                          Attendance Logs
                        </span>
                        <span className="text-lg font-black text-slate-900">
                          {empStats?.totalAttendance !== undefined ? empStats.totalAttendance : 0} <span className="text-xs font-semibold text-slate-500">days</span>
                        </span>
                      </div>

                      <div className="p-3.5 bg-purple-50/60 rounded-2xl border border-purple-100">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-purple-600 block mb-1">
                          Meetings / Tasks
                        </span>
                        <span className="text-lg font-black text-slate-900">
                          {empStats?.totalMeetings || 0} / {empStats?.totalTasks || 0}
                        </span>
                      </div>

                      <div className="p-3.5 bg-amber-50/60 rounded-2xl border border-amber-100">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-amber-600 block mb-1">
                          Total Sessions
                        </span>
                        <span className="text-lg font-black text-slate-900">
                          {empStats?.totalSessions || 0} <span className="text-xs font-semibold text-slate-500">GPS logs</span>
                        </span>
                      </div>
                    </div>

                    {/* Section 1: Contact & Employment */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <div className="space-y-2.5">
                        <h4 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider text-blue-600">
                          Contact Details
                        </h4>
                        <div className="flex items-center gap-2 text-slate-600">
                          <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <span className="font-medium truncate">{selectedEmp.email || 'No email registered'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600">
                          <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <span className="font-medium">{selectedEmp.phone || 'No phone registered'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600">
                          <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <span className="font-medium">{selectedEmp.allocatedArea || 'Default Zone'}</span>
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        <h4 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider text-blue-600">
                          Organization Role
                        </h4>
                        <div className="flex items-center gap-2 text-slate-600">
                          <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <span>Department: <strong className="text-slate-900">{selectedEmp.department || 'Field Services'}</strong></span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600">
                          <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <div className="flex items-center gap-2 flex-1">
                            <span>Manager:</span>
                            <select
                              value={selectedEmp.manager?._id || selectedEmp.managerId || selectedEmp.manager || ''}
                              onChange={(e) => handleQuickAssignManager(selectedEmp._id, e.target.value)}
                              disabled={updatingEmpManager}
                              className="px-2 py-1 text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 shadow-xs"
                            >
                              <option value="">No Manager (Unassigned)</option>
                              {managersList.map((m) => (
                                <option key={m._id} value={m._id}>
                                  {m.name} ({m.department || 'Management'})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600">
                          <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <span>Joined: <strong className="text-slate-900">{selectedEmp.createdAt ? new Date(selectedEmp.createdAt).toLocaleDateString() : 'Active'}</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Compensation & Allowances */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <h4 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider text-blue-600 mb-3">
                        Payroll & Allowances
                      </h4>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-white p-3 rounded-xl border border-slate-200">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Monthly Salary</span>
                          <span className="text-sm font-bold text-slate-900">₹{selectedEmp.salary || 12000}</span>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-slate-200">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Travel Allowance</span>
                          <span className="text-sm font-bold text-slate-900">₹{selectedEmp.TA || 2.5}/km</span>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-slate-200">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Daily Allowance (DA)</span>
                          <span className="text-sm font-bold text-slate-900">₹{selectedEmp.DA || 0}</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Footer Actions */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleBlock(selectedEmp)}
                    disabled={blockingId === selectedEmp._id}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border shadow-xs transition ${
                      selectedEmp.isBlocked
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-transparent'
                        : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300'
                    }`}
                  >
                    {blockingId === selectedEmp._id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : selectedEmp.isBlocked ? (
                      <ShieldCheck className="w-3.5 h-3.5" />
                    ) : (
                      <ShieldAlert className="w-3.5 h-3.5" />
                    )}
                    {selectedEmp.isBlocked ? 'Unblock Employee' : 'Block Employee'}
                  </button>

                  <button
                    onClick={() => {
                      setEmpToDelete(selectedEmp);
                      setSelectedEmp(null);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-300 shadow-xs transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Employee
                  </button>
                </div>

                <button
                  onClick={() => setSelectedEmp(null)}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold shadow-xs transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 2. DELETE CONFIRMATION MODAL (CASCADE DELETE PERMISSION)                  */}
        {/* ========================================================================= */}
        {empToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-100 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Delete Employee & All Data?</h3>
                  <p className="text-xs text-rose-600 font-semibold">Irreversible action with cascade data purge</p>
                </div>
              </div>

              <div className="p-3.5 bg-rose-50/70 rounded-2xl border border-rose-200/80 text-xs text-rose-800 space-y-2">
                <p>
                  Are you sure you want to delete <strong className="font-bold text-rose-950">{empToDelete.name}</strong> ({empToDelete.employeeId || 'EMP ID'})?
                </p>
                <p className="text-[11px] leading-relaxed text-rose-700">
                  ⚠️ <strong>Notice:</strong> This action will permanently remove this employee and <strong>ALL associated database records</strong>:
                </p>
                <ul className="list-disc list-inside text-[11px] text-rose-700 space-y-0.5 ml-1">
                  <li>GPS Tracking sessions & coordinates</li>
                  <li>Attendance logs & punch history</li>
                  <li>Meetings created by employee</li>
                  <li>Expenses & submitted receipts</li>
                  <li>Assigned tasks & leave requests</li>
                </ul>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setEmpToDelete(null)}
                  className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleConfirmDelete}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-50"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Deleting All Data...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      Confirm & Delete Everything
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. FLOATING BULK ASSIGN MANAGER BAR                                       */}
        {/* ========================================================================= */}
        {selectedIds.length > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 backdrop-blur-md text-white px-6 py-3.5 rounded-2xl shadow-2xl border border-slate-700 flex flex-wrap items-center gap-4 animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center gap-2 font-bold text-xs">
              <span className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-black">
                {selectedIds.length}
              </span>
              <span>Employees Selected</span>
            </div>

            <div className="h-4 w-px bg-slate-700 hidden sm:block" />

            <div className="flex items-center gap-2">
              <select
                value={bulkManagerId}
                onChange={(e) => setBulkManagerId(e.target.value)}
                className="bg-slate-800 text-white text-xs rounded-xl px-3 py-2 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose Manager to Assign...</option>
                {managersList.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.name} ({m.department || 'Management'})
                  </option>
                ))}
              </select>

              <button
                onClick={handleBulkAssignManager}
                disabled={assigningBulk || !bulkManagerId}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-sm cursor-pointer"
              >
                {assigningBulk ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                Assign Manager
              </button>
            </div>

            <button
              onClick={() => setSelectedIds([])}
              className="text-xs text-slate-400 hover:text-white underline ml-1 cursor-pointer"
            >
              Clear Selection
            </button>
          </div>
        )}
      </div>
    </TrackProLayout>
  );
}
