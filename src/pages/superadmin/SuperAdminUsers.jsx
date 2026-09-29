import React, { useState, useEffect } from 'react';
import TrackProLayout from '../../components/layout/TrackProLayout';
import {
  Users,
  Search,
  RefreshCw,
  Key,
  CheckCircle2,
  XCircle,
  Shield,
  UserCheck,
  Building2,
  Lock,
  Phone,
  Mail,
  Filter,
  Eye,
  SlidersHorizontal,
  X,
  Check,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';
import { API } from '../../services/api.service';
import Avatar from '../../components/shared/Avatar';
import toast from 'react-hot-toast';

export default function SuperAdminUsers() {
  const [users, setUsers] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [roleStats, setRoleStats] = useState({
    totalUsers: 0,
    orgAdmins: 0,
    managers: 0,
    employees: 0,
    activeUsers: 0,
    onlineUsers: 0,
  });
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [orgFilter, setOrgFilter] = useState('all');

  // Modals
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await API.get('/superadmin/users', {
        params: {
          search: searchTerm,
          role: roleFilter,
          status: statusFilter,
          organizationId: orgFilter,
        },
      });
      if (res.data?.success) {
        setUsers(res.data.users || []);
        if (res.data.roleStats) setRoleStats(res.data.roleStats);
      }
    } catch (error) {
      toast.error('Failed to load users directory');
    } finally {
      setLoading(false);
    }
  };

  const fetchOrganizations = async () => {
    try {
      const res = await API.get('/superadmin/organizations');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setOrganizations(res.data.data);
      }
    } catch (error) {
      console.warn('Failed to load org list');
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [roleFilter, statusFilter, orgFilter]);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchUsers();
  };

  const handleToggleStatus = async (user) => {
    try {
      const newStatus = !user.isActive;
      const res = await API.patch(`/superadmin/users/${user._id}/status`, {
        isActive: newStatus,
      });
      if (res.data?.success) {
        toast.success(`User ${user.name} is now ${newStatus ? 'ACTIVE' : 'DEACTIVATED'}`);
        setUsers((prev) =>
          prev.map((u) => (u._id === user._id ? { ...u, isActive: newStatus } : u))
        );
      }
    } catch (error) {
      toast.error('Failed to update user status');
    }
  };

  const handleOpenPasswordModal = (user) => {
    setSelectedUser(user);
    setNewPassword('');
    setShowPasswordModal(true);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    try {
      setResettingPassword(true);
      const res = await API.patch(`/superadmin/users/${selectedUser._id}/password`, {
        newPassword,
      });
      if (res.data?.success) {
        toast.success(`Password reset successfully for ${selectedUser.name}! 🔑`);
        setShowPasswordModal(false);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to reset password');
    } finally {
      setResettingPassword(false);
    }
  };

  return (
    <TrackProLayout>
      <div className="space-y-6 pb-12">
        {/* Modern Super Admin Header Bar */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 rounded-md flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-blue-600" /> Cross-Tenant Directory
              </span>
              <span className="text-xs text-slate-400 font-semibold">Master Accounts Directory</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-1 tracking-tight">
              Global Users & Accounts Directory
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
              Inspect and manage all Org Admins, Managers, and Field Employees across every registered organization.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchUsers}
              className="p-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200 shadow-xs transition cursor-pointer flex items-center gap-2 text-xs font-bold"
              title="Refresh Users"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Real-time KPI Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Accounts</span>
            <h4 className="text-2xl font-black text-slate-900 mt-1">{roleStats.totalUsers}</h4>
            <span className="text-[11px] text-blue-600 font-semibold block mt-0.5">Across All Tenants</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Org Admins</span>
            <h4 className="text-2xl font-black text-indigo-700 mt-1">{roleStats.orgAdmins}</h4>
            <span className="text-[11px] text-indigo-600 font-semibold block mt-0.5">Tenant Owners</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Field Managers</span>
            <h4 className="text-2xl font-black text-purple-700 mt-1">{roleStats.managers}</h4>
            <span className="text-[11px] text-purple-600 font-semibold block mt-0.5">Team Leads</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Field Staff</span>
            <h4 className="text-2xl font-black text-emerald-700 mt-1">{roleStats.employees}</h4>
            <span className="text-[11px] text-emerald-600 font-semibold block mt-0.5">Field Executives</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Status</span>
            <h4 className="text-2xl font-black text-emerald-600 mt-1">{roleStats.activeUsers}</h4>
            <span className="text-[11px] text-emerald-700 font-semibold block mt-0.5">Unblocked</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Online Right Now</span>
            <h4 className="text-2xl font-black text-rose-600 mt-1">{roleStats.onlineUsers}</h4>
            <span className="text-[11px] text-rose-600 font-semibold block mt-0.5">Live Sessions</span>
          </div>
        </div>

        {/* Toolbar & Filters */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Search by name, email, phone, employee ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-20 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 font-semibold"
            />
            <button
              type="submit"
              className="absolute right-2 top-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition"
            >
              Search
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-3">
            {/* Role Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500 uppercase">Role:</span>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-800"
              >
                <option value="all">All Roles</option>
                <option value="ORG_ADMIN">Org Admin</option>
                <option value="MANAGER">Manager</option>
                <option value="EMPLOYEE">Employee</option>
                <option value="SUPER_ADMIN">Super Admin</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500 uppercase">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-800"
              >
                <option value="all">All Status</option>
                <option value="active">Active Only</option>
                <option value="inactive">Deactivated Only</option>
              </select>
            </div>

            {/* Organization Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500 uppercase">Tenant:</span>
              <select
                value={orgFilter}
                onChange={(e) => setOrgFilter(e.target.value)}
                className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-800 max-w-[160px] truncate"
              >
                <option value="all">All Organizations</option>
                {organizations.map((org) => (
                  <option key={org._id} value={org._id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
                  <th className="py-4 px-6">User Account</th>
                  <th className="py-4 px-6">Assigned Role</th>
                  <th className="py-4 px-6">Organization Tenant</th>
                  <th className="py-4 px-6">Contact Info</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6">Joined Date</th>
                  <th className="py-4 px-6 text-right">Admin Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm font-semibold">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-slate-400 font-normal">
                      No user accounts found matching selected criteria.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => {
                    const uRole = (u.role || '').toUpperCase();
                    const isSuper = uRole === 'SUPER_ADMIN' || uRole === 'SUPERADMIN';
                    const isOrgAdm = uRole === 'ORG_ADMIN' || uRole === 'ADMIN';
                    const isMgr = uRole === 'MANAGER';

                    return (
                      <tr key={u._id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <Avatar name={u.name} src={u.avatar} size="md" />
                            <div>
                              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                <span>{u.name}</span>
                                {u.isOnline && (
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" title="Online" />
                                )}
                              </div>
                              <div className="text-xs text-slate-400 font-mono">
                                {u.employeeId || 'ID: ' + u._id.slice(-6).toUpperCase()}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-6">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-black uppercase tracking-wider border ${
                              isSuper
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : isOrgAdm
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                : isMgr
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {uRole}
                          </span>
                        </td>

                        <td className="py-4 px-6">
                          <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
                            <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span className="truncate max-w-[180px]">
                              {u.organizationId?.name || (isSuper ? 'Master Platform' : 'Independent')}
                            </span>
                          </div>
                          {u.organizationId?.slug && (
                            <span className="text-[10px] text-slate-400 font-mono block">
                              slug: {u.organizationId.slug}
                            </span>
                          )}
                        </td>

                        <td className="py-4 px-6">
                          <div className="text-slate-800 text-xs flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5 text-slate-400" /> {u.email}
                          </div>
                          <div className="text-slate-500 text-[11px] flex items-center gap-1 mt-0.5">
                            <Phone className="w-3.5 h-3.5 text-slate-400" /> {u.phone || 'N/A'}
                          </div>
                        </td>

                        <td className="py-4 px-6">
                          {u.isActive ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <XCircle className="w-3 h-3 text-rose-500" /> Inactive
                            </span>
                          )}
                        </td>

                        <td className="py-4 px-6 text-xs text-slate-500">
                          {new Date(u.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>

                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenPasswordModal(u)}
                              className="px-2.5 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer flex items-center gap-1"
                              title="Reset Password"
                            >
                              <Key className="w-3.5 h-3.5 text-amber-600" />
                              <span>Reset Password</span>
                            </button>

                            <button
                              onClick={() => handleToggleStatus(u)}
                              className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                                u.isActive
                                  ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              {u.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Reset Password Modal */}
        {showPasswordModal && selectedUser && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">Direct Password Reset</h3>
                    <p className="text-xs text-slate-500">Super Admin Security Override</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPasswordModal(false)}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleResetPassword} className="space-y-4 mt-4">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700">
                  Resetting password for: <span className="font-bold text-slate-900">{selectedUser.name}</span> (
                  {selectedUser.email})
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">New Password</label>
                  <input
                    type="password"
                    required
                    placeholder="Enter minimum 6 characters..."
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setShowPasswordModal(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resettingPassword}
                    className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition disabled:opacity-50"
                  >
                    {resettingPassword ? 'Updating...' : 'Set New Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </TrackProLayout>
  );
}
