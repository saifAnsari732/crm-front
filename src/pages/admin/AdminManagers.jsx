import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import KisanConnectLayout from '../../components/layout/KisanConnectLayout';
import { useAuth } from '../../contexts/AuthContext';
import {
  Users,
  UserCheck,
  UserX,
  UserPlus,
  Search,
  Filter,
  Eye,
  Plus,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Phone,
  Mail,
  Building2,
  ChevronRight,
  UserMinus,
  X,
  Lock,
  DollarSign,
  Briefcase,
  Loader2,
  User,
  ShieldCheck,
  CreditCard,
} from 'lucide-react';
import { API, adminAPI } from '../../services/api.service';
import toast from 'react-hot-toast';
import Avatar from '../../components/shared/Avatar';

export default function AdminManagers() {
  const { user, organization } = useAuth();
  const navigate = useNavigate();

  const userRole = (user?.role || '').toUpperCase();
  const isSuperAdmin = userRole === 'SUPER_ADMIN' || userRole === 'SUPERADMIN';
  
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

  const maxManagers = isSuperAdmin ? 9999 : (livePlanLimits.maxManagers || organization?.plan?.maxManagers || 3);

  const [managers, setManagers] = useState([]);
  const [employeesList, setEmployeesList] = useState([]);
  const [selectedManager, setSelectedManager] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedEmpIds, setSelectedEmpIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // New Manager Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    department: 'Field Services',
    designation: 'Area Manager',
    password: '',
    salary: 25000,
  });

  const fetchManagersData = async () => {
    try {
      setLoading(true);
      const [mgrRes, empRes] = await Promise.all([
        API.get('/admin/managers').catch(() => ({ data: { success: false } })),
        API.get('/employees').catch(() => ({ data: { success: false } })),
      ]);

      let mgrs = [];
      if (mgrRes.data?.success && Array.isArray(mgrRes.data.managers)) {
        mgrs = mgrRes.data.managers;
      }

      setManagers(mgrs);
      if (mgrs.length > 0) {
        setSelectedManager((prev) => (prev ? mgrs.find((m) => m._id === prev._id) || mgrs[0] : mgrs[0]));
      }

      if (empRes.data?.success && Array.isArray(empRes.data.employees)) {
        // Filter out managers so only regular field staff are assignable
        const fieldStaff = empRes.data.employees.filter(
          (e) => e.role !== 'manager' && e.role !== 'MANAGER' && e.role !== 'ORG_ADMIN' && e.role !== 'SUPER_ADMIN'
        );
        setEmployeesList(fieldStaff);
      }
    } catch (error) {
      console.error('Error loading managers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchManagersData();
  }, []);

  const handleOpenAddModal = () => {
    if (!isPlanActive) {
      toast.error('❌ Active Subscription Plan Required! Please activate your plan in Billing to add managers.', {
        id: 'plan-check-add-mgr',
        duration: 5000,
      });
      navigate('/admin/billing');
      return;
    }

    if (managers.length >= maxManagers) {
      toast.error(`⚠️ Manager Quota Full (${managers.length}/${maxManagers} Seats Used)! Your current plan limit is reached. Please upgrade your plan in Billing to add more managers.`, {
        id: 'quota-full-mgr',
        duration: 6000,
      });
      navigate('/admin/billing');
      return;
    }

    setShowAddModal(true);
  };

  const handleCreateManager = async (e) => {
    e.preventDefault();
    if (!isPlanActive) {
      toast.error('❌ Active Subscription Plan Required! Please activate a plan in Billing.');
      navigate('/admin/billing');
      return;
    }

    if (managers.length >= maxManagers) {
      toast.error(`⚠️ Manager Quota Full (${managers.length}/${maxManagers} Seats Used)! Please upgrade your plan in Billing.`);
      navigate('/admin/billing');
      return;
    }

    if (!formData.name.trim() || !formData.email.trim()) {
      toast.error('Name and email are required');
      return;
    }

    try {
      setCreating(true);
      const res = await adminAPI.createManager(formData);
      if (res.data?.success) {
        toast.success(`🎉 Manager ${res.data.manager?.name || formData.name} created successfully!`);
        setShowAddModal(false);
        setFormData({
          name: '',
          email: '',
          phone: '',
          department: 'Field Services',
          designation: 'Area Manager',
          password: '',
          salary: 25000,
        });
        fetchManagersData();
      }
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to create manager';
      toast.error(msg, { duration: 6000 });
      if (error.response?.data?.limitReached) {
        setTimeout(() => navigate('/admin/billing'), 1500);
      }
    } finally {
      setCreating(false);
    }
  };

  const handleAssignEmployees = async () => {
    if (!isPlanActive) {
      toast.error('❌ Active Subscription Plan Required! Please activate a plan in Billing.');
      navigate('/admin/billing');
      return;
    }

    if (!selectedManager || selectedEmpIds.length === 0) {
      toast.error('Select at least one employee');
      return;
    }

    try {
      const res = await API.post('/employees/assign-manager', {
        employeeIds: selectedEmpIds,
        managerId: selectedManager._id,
      });

      if (res.data?.success) {
        toast.success(`🎉 Assigned ${selectedEmpIds.length} employee(s) to ${selectedManager.name}!`);
        setShowAssignModal(false);
        setSelectedEmpIds([]);
        fetchManagersData();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to assign employees');
    }
  };

  const distinctDepts = Array.from(new Set(managers.map((m) => m.department).filter(Boolean)));

  const filteredManagers = managers.filter((m) => {
    const matchesSearch =
      m.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.employeeId?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = departmentFilter === 'all' || m.department === departmentFilter;
    return matchesSearch && matchesDept;
  });

  const currentManager = selectedManager || (filteredManagers.length > 0 ? filteredManagers[0] : null);
  const totalAssignedEmployees = managers.reduce((acc, m) => acc + (m.assignedEmployees?.length || 0), 0);
  const onlineManagers = managers.filter((m) => m.isOnline).length;

  return (
    <KisanConnectLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-blue-600" />
              <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Management Control</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">Managers</h1>
            <p className="text-slate-500 text-sm">Manage your organization's managers, their teams, and assigned employees.</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenAddModal}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-500/20 flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add Manager
            </button>
          </div>
        </div>

        {/* KisanConnect KPI Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Total Managers</p>
              <h3 className="text-xl font-bold text-slate-900">{managers.length}</h3>
              <span className="text-[10px] text-emerald-600 font-semibold">Active in DB</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center font-bold">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Manager Departments</p>
              <h3 className="text-xl font-bold text-slate-900">{distinctDepts.length || 1}</h3>
              <span className="text-[10px] text-slate-400">Covered</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Assigned Employees</p>
              <h3 className="text-xl font-bold text-slate-900">{totalAssignedEmployees}</h3>
              <span className="text-[10px] text-indigo-600 font-semibold">Under Supervision</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Online Managers</p>
              <h3 className="text-xl font-bold text-slate-900">{onlineManagers}</h3>
              <span className="text-[10px] text-emerald-600 font-semibold">Connected Now</span>
            </div>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-[280px]">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search manager by name, email, employee ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none"
            >
              <option value="all">All Departments</option>
              {distinctDepts.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> New Manager
          </button>
        </div>

        {/* Main Content Layout: Table + Manager Details Side Drawer */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Managers List Table */}
          <div className={`${currentManager ? 'lg:col-span-7' : 'lg:col-span-12'} bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden`}>
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Registered Managers ({filteredManagers.length})</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Manager</th>
                    <th className="py-3 px-4">ID</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Team Size</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredManagers.length > 0 ? (
                    filteredManagers.map((mgr) => (
                      <tr
                        key={mgr._id}
                        onClick={() => setSelectedManager(mgr)}
                        className={`cursor-pointer transition-colors ${
                          currentManager?._id === mgr._id ? 'bg-blue-50/60 font-medium' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <Avatar src={mgr.avatar} name={mgr.name} size="sm" />
                            <div>
                              <div className="font-semibold text-slate-900">{mgr.name}</div>
                              <div className="text-[11px] text-slate-400">{mgr.email}</div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4 font-mono text-slate-600">
                          {mgr.employeeId || 'MGR-' + mgr._id.slice(-6).toUpperCase()}
                        </td>

                        <td className="py-3 px-4">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                            {mgr.department || 'Field Services'}
                          </span>
                        </td>

                        <td className="py-3 px-4 font-bold text-slate-900">
                          {mgr.assignedEmployees?.length || 0} Members
                        </td>

                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedManager(mgr);
                            }}
                            className="px-2.5 py-1 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="py-12 text-center text-xs text-slate-400">
                        {loading ? 'Loading managers from database...' : 'No managers registered yet.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Manager Details Side Drawer */}
          {currentManager && (
            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-6">
              <div className="border-b pb-4">
                <h3 className="text-sm font-bold text-slate-900">Manager Details</h3>
              </div>

              <div className="flex items-center gap-4">
                <Avatar
                  src={currentManager.avatar}
                  name={currentManager.name}
                  size="xl"
                  shape="rounded-2xl"
                />
                <div>
                  <h4 className="text-base font-bold text-slate-900">{currentManager.name}</h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      {currentManager.employeeId || 'MGR-' + currentManager._id.slice(-6).toUpperCase()}
                    </span>
                    <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
                      {currentManager.department || 'Field Services'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>{currentManager.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{currentManager.phone || 'Contact on file'}</span>
                </div>
              </div>

              {/* Team Members List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Assigned Team ({currentManager.assignedEmployees?.length || 0})
                  </h4>
                  <button
                    onClick={() => setShowAssignModal(true)}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    + Assign Employees
                  </button>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {!currentManager.assignedEmployees || currentManager.assignedEmployees.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-6">No employees currently assigned to this manager.</p>
                  ) : (
                    currentManager.assignedEmployees.map((emp) => (
                      <div key={emp._id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl text-xs border border-slate-100">
                        <div className="flex items-center gap-2.5">
                          <Avatar src={emp.avatar} name={emp.name} size="xs" />
                          <div>
                            <div className="font-semibold text-slate-900">{emp.name}</div>
                            <div className="text-[10px] text-slate-500">{emp.department || 'Field Services'}</div>
                          </div>
                        </div>
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Assign Action Button */}
              <div className="pt-2 border-t">
                <button
                  onClick={() => setShowAssignModal(true)}
                  className="w-full p-2.5 bg-blue-50 text-blue-600 hover:bg-blue-100 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Assign Employees to {currentManager.name}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* ⭐ ADD NEW MANAGER MODAL ⭐ */}
        {/* ========================================================= */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-slate-200">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Add New Manager</h3>
                    <p className="text-xs text-slate-500">Register a new management user for your organization.</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateManager} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Kumar"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Email Address *</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="email"
                        required
                        placeholder="manager@example.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Phone Number</label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="tel"
                        placeholder="e.g. 9876543210"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Department</label>
                    <div className="relative">
                      <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="e.g. Field Services"
                        value={formData.department}
                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Designation</label>
                    <div className="relative">
                      <Briefcase className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="e.g. Area Manager"
                        value={formData.designation}
                        onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Login Password</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="Default: 111111"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Monthly Salary (₹)</label>
                    <div className="relative">
                      <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="number"
                        placeholder="25000"
                        value={formData.salary}
                        onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-5 py-2 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 flex items-center gap-1.5 transition disabled:opacity-50"
                  >
                    {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                    {creating ? 'Creating...' : 'Create Manager'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Assign Employees Modal */}
        {showAssignModal && currentManager && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-200">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Assign Employees to {currentManager.name}</h3>
                  <p className="text-xs text-slate-500">Select employees from this organization to assign.</p>
                </div>
                <button onClick={() => setShowAssignModal(false)} className="text-slate-400 hover:text-slate-600">
                  ✕
                </button>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2 divide-y divide-slate-100 text-xs">
                {employeesList.length > 0 ? (
                  employeesList.map((emp) => (
                    <label key={emp._id} className="flex items-center justify-between pt-2 cursor-pointer hover:bg-slate-50 p-1.5 rounded">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedEmpIds.includes(emp._id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedEmpIds([...selectedEmpIds, emp._id]);
                            else setSelectedEmpIds(selectedEmpIds.filter((id) => id !== emp._id));
                          }}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <div className="font-semibold text-slate-900">{emp.name}</div>
                          <div className="text-[10px] text-slate-400">{emp.email} | {emp.department}</div>
                        </div>
                      </div>
                    </label>
                  ))
                ) : (
                  <div className="text-center py-6 text-slate-400 text-xs">No unassigned field employees available.</div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 border rounded-xl hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignEmployees}
                  className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-sm"
                >
                  Confirm Assignment
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </KisanConnectLayout>
  );
}
