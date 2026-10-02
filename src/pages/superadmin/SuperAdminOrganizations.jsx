import React, { useState, useEffect } from 'react';
import KisanConnectLayout from '../../components/layout/KisanConnectLayout';
import {
  Building2,
  Users,
  ShieldCheck,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Activity,
  Edit,
  Sliders,
  Calendar,
  CreditCard,
  RefreshCw,
  Phone,
  Mail,
  Zap,
} from 'lucide-react';
import { API } from '../../services/api.service';
import toast from 'react-hot-toast';

export default function SuperAdminOrganizations() {
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSubModal, setShowSubModal] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
    planName: 'Growth Pro Plan',
    maxEmployees: 50,
    maxManagers: 10,
  });

  const [subData, setSubData] = useState({
    planName: 'Growth Pro Plan',
    maxEmployees: 50,
    maxManagers: 10,
    addDays: 30,
  });

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      const res = await API.get('/superadmin/organizations');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setOrganizations(res.data.data);
      }
    } catch (error) {
      toast.error('Failed to load organizations data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const handleCreateOrg = async (e) => {
    e.preventDefault();
    try {
      const res = await API.post('/superadmin/organizations', formData);
      if (res.data?.success) {
        toast.success(`🎉 Organization "${formData.name}" onboarded successfully!`);
        setShowCreateModal(false);
        setFormData({
          name: '',
          email: '',
          phone: '',
          address: '',
          adminName: '',
          adminEmail: '',
          adminPassword: '',
          planName: 'Growth Pro Plan',
          maxEmployees: 50,
          maxManagers: 10,
        });
        fetchOrganizations();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create organization');
    }
  };

  const handleStatusChange = async (orgId, status) => {
    try {
      await API.patch(`/superadmin/organizations/${orgId}/status`, { status });
      toast.success(`Status updated to ${status.toUpperCase()}`);
      fetchOrganizations();
    } catch (error) {
      toast.error('Failed to update organization status');
    }
  };

  const handleOpenSubModal = (org) => {
    setSelectedOrg(org);
    setSubData({
      planName: org.plan?.planName || 'Growth Pro Plan',
      maxEmployees: org.plan?.maxEmployees || 50,
      maxManagers: org.plan?.maxManagers || 10,
      addDays: 30,
    });
    setShowSubModal(true);
  };

  const handleUpdateSub = async (e) => {
    e.preventDefault();
    if (!selectedOrg) return;
    try {
      const res = await API.patch(`/superadmin/organizations/${selectedOrg._id}/subscription`, subData);
      if (res.data?.success) {
        toast.success(`Subscription updated for ${selectedOrg.name}!`);
        setShowSubModal(false);
        fetchOrganizations();
      }
    } catch (error) {
      toast.error('Failed to update subscription');
    }
  };

  const filteredOrgs = organizations.filter((org) => {
    const matchesSearch =
      org.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      org.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      org.slug?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || org.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <KisanConnectLayout>
      <div className="space-y-6 pb-12">
        {/* Modern Super Admin Header Bar */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md">
                Multi-Tenant Directory
              </span>
              <span className="text-xs text-slate-400 font-semibold">Tenant & Quota Control</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-1 tracking-tight">
              Customer Organizations Management
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
              View tenant status, user quotas, revenue generated, and manage custom subscription renewals.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchOrganizations}
              className="p-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200 shadow-xs transition cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" /> Onboard New Organization
            </button>
          </div>
        </div>

        {/* Filters & Search Toolbar */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Search by company name, email, or slug..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-semibold"
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-500 uppercase">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-800"
            >
              <option value="all">All Organizations ({organizations.length})</option>
              <option value="active">Active Tenants</option>
              <option value="suspended">Suspended Tenants</option>
            </select>
          </div>
        </div>

        {/* Organizations Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
                  <th className="py-4 px-6">Company / Slug</th>
                  <th className="py-4 px-6">Contact Email & Phone</th>
                  <th className="py-4 px-6">Plan & Quotas</th>
                  <th className="py-4 px-6">Active Staff</th>
                  <th className="py-4 px-6">Total Revenue</th>
                  <th className="py-4 px-6">Subscription Expiry</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm font-semibold">
                {filteredOrgs.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-slate-400 font-normal">
                      No organizations found matching search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredOrgs.map((org) => (
                    <tr key={org._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 font-black flex items-center justify-center text-sm border border-indigo-100 flex-shrink-0">
                            {org.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{org.name}</div>
                            <div className="font-mono text-[11px] text-slate-400">{org.slug}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        <div className="text-slate-800 text-xs flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5 text-slate-400" /> {org.email}
                        </div>
                        <div className="text-slate-500 text-[11px] flex items-center gap-1 mt-0.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400" /> {org.phone || 'N/A'}
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {org.plan?.planName || 'Growth Pro'}
                        </span>
                        <div className="text-xs text-slate-500 font-normal mt-0.5">
                          Max: {org.plan?.maxEmployees || 50} Employees
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        <div className="text-slate-900 font-bold">
                          {org.currentEmployeeCount || 0} / {org.plan?.maxEmployees || 50}
                        </div>
                        <div className="text-xs text-slate-500 font-normal">
                          Managers: {org.currentManagerCount || 0}
                        </div>
                      </td>

                      <td className="py-4 px-6 text-emerald-600 font-black">
                        ₹{(org.totalRevenuePaid || 0).toLocaleString('en-IN')}
                      </td>

                      <td className="py-4 px-6 text-xs text-slate-600">
                        {org.plan?.expiresAt ? new Date(org.plan.expiresAt).toLocaleDateString('en-IN') : 'Active / Unlimited'}
                      </td>

                      <td className="py-4 px-6">
                        {org.status === 'active' ? (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Active
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            Suspended
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenSubModal(org)}
                            className="px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition cursor-pointer"
                          >
                            Edit Plan
                          </button>

                          {org.status === 'active' ? (
                            <button
                              onClick={() => handleStatusChange(org._id, 'suspended')}
                              className="px-3 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition cursor-pointer"
                            >
                              Suspend
                            </button>
                          ) : (
                            <button
                              onClick={() => handleStatusChange(org._id, 'active')}
                              className="px-3 py-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition cursor-pointer"
                            >
                              Activate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* MODAL 1: ADD ORGANIZATION MODAL */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-5 border border-slate-200">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Onboard Organization</h3>
                  <p className="text-xs text-slate-500">Manual tenant creation for Super Admin</p>
                </div>
                <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>

              <form onSubmit={handleCreateOrg} className="space-y-4 text-sm font-semibold">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-700 mb-1">Company Name</label>
                    <input
                      type="text"
                      required
                      placeholder="Kisan Choice Agro"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-700 mb-1">Company Email</label>
                    <input
                      type="email"
                      required
                      placeholder="admin@kisanchoice.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-700 mb-1">Phone</label>
                    <input
                      type="text"
                      placeholder="+91 9511450914"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-700 mb-1">Subscription Plan</label>
                    <select
                      value={formData.planName}
                      onChange={(e) => setFormData({ ...formData, planName: e.target.value })}
                      className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="Starter Plan">Starter Plan (10 Emp)</option>
                      <option value="Growth Pro Plan">Growth Pro Plan (50 Emp)</option>
                      <option value="Enterprise Plan">Enterprise Plan (500 Emp)</option>
                    </select>
                  </div>
                </div>

                <div className="border-t pt-3">
                  <h4 className="text-xs uppercase text-slate-500 font-bold mb-2">Admin Login Credentials</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-slate-700 mb-1">Admin Password</label>
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={formData.adminPassword}
                        onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                        className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-700 mb-1">Max Employee Limit</label>
                      <input
                        type="number"
                        value={formData.maxEmployees}
                        onChange={(e) => setFormData({ ...formData, maxEmployees: Number(e.target.value) })}
                        className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 border rounded-xl text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-bold shadow-md"
                  >
                    Onboard Organization
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: EDIT SUBSCRIPTION MODAL */}
        {showSubModal && selectedOrg && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-slate-200">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Update Subscription</h3>
                  <p className="text-xs text-slate-500">For {selectedOrg.name}</p>
                </div>
                <button onClick={() => setShowSubModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>

              <form onSubmit={handleUpdateSub} className="space-y-4 text-sm font-semibold">
                <div>
                  <label className="block text-xs text-slate-700 mb-1">Plan Title</label>
                  <input
                    type="text"
                    value={subData.planName}
                    onChange={(e) => setSubData({ ...subData, planName: e.target.value })}
                    className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-700 mb-1">Max Employee Limit</label>
                    <input
                      type="number"
                      value={subData.maxEmployees}
                      onChange={(e) => setSubData({ ...subData, maxEmployees: Number(e.target.value) })}
                      className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-700 mb-1">Extend Access (Days)</label>
                    <input
                      type="number"
                      value={subData.addDays}
                      onChange={(e) => setSubData({ ...subData, addDays: Number(e.target.value) })}
                      className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setShowSubModal(false)}
                    className="px-4 py-2 border rounded-xl text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-bold shadow-md"
                  >
                    Save & Renew Subscription
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </KisanConnectLayout>
  );
}
