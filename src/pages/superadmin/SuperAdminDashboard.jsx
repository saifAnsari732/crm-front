import React, { useState, useEffect } from 'react';
import TrackProLayout from '../../components/layout/TrackProLayout';
import {
  Building2,
  Users,
  ShieldCheck,
  TrendingUp,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  MoreVertical,
  Activity,
  Layers,
  CreditCard,
  DollarSign,
  Calendar,
  Settings,
  RefreshCw,
  FileText,
  Lock,
  Zap,
  Check,
  PhoneCall,
  ExternalLink,
  Sliders,
  ShieldAlert,
  ArrowUpRight,
  Eye,
} from 'lucide-react';
import { API } from '../../services/api.service';
import toast from 'react-hot-toast';

export default function SuperAdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'organizations' | 'payments' | 'plans' | 'settings'

  const [stats, setStats] = useState({
    totalOrgs: 0,
    activeOrgs: 0,
    trialOrgs: 0,
    suspendedOrgs: 0,
    totalUsers: 0,
    totalEmployees: 0,
    totalManagers: 0,
    totalDistanceTracked: 0,
    totalRevenue: 0,
    paidTransactionsCount: 0,
  });

  const [organizations, setOrganizations] = useState([]);
  const [payments, setPayments] = useState([]);
  const [paymentSummary, setPaymentSummary] = useState({
    totalRevenue: 0,
    paidCount: 0,
    failedCount: 0,
    createdCount: 0,
    avgOrderValue: 0,
  });

  const [loading, setLoading] = useState(true);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');

  // Form data for creating organization
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

  // Form data for updating subscription
  const [subData, setSubData] = useState({
    planName: 'Growth Pro Plan',
    maxEmployees: 50,
    maxManagers: 10,
    addDays: 30,
  });

  const fetchSuperAdminData = async () => {
    try {
      setLoading(true);
      const [statsRes, orgsRes, paymentsRes] = await Promise.all([
        API.get('/superadmin/stats').catch(() => ({ data: { success: false } })),
        API.get('/superadmin/organizations').catch(() => ({ data: { success: false } })),
        API.get('/superadmin/payments').catch(() => ({ data: { success: false } })),
      ]);

      if (statsRes.data?.success) setStats(statsRes.data.data);
      if (orgsRes.data?.success && Array.isArray(orgsRes.data.data)) setOrganizations(orgsRes.data.data);
      if (paymentsRes.data?.success) {
        setPayments(paymentsRes.data.payments || []);
        if (paymentsRes.data.summary) setPaymentSummary(paymentsRes.data.summary);
      }
    } catch (error) {
      console.error('Error fetching SuperAdmin data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuperAdminData();
  }, []);

  const handleCreateOrg = async (e) => {
    e.preventDefault();
    try {
      const res = await API.post('/superadmin/organizations', formData);
      if (res.data?.success) {
        toast.success(`🎉 Organization "${formData.name}" onboarded!`);
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
        fetchSuperAdminData();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create organization');
    }
  };

  const handleStatusChange = async (orgId, status) => {
    try {
      await API.patch(`/superadmin/organizations/${orgId}/status`, { status });
      toast.success(`Organization status updated to ${status.toUpperCase()}`);
      fetchSuperAdminData();
    } catch (error) {
      toast.error('Failed to update organization status');
    }
  };

  const handleOpenSubscriptionModal = (org) => {
    setSelectedOrg(org);
    setSubData({
      planName: org.plan?.planName || 'Growth Pro Plan',
      maxEmployees: org.plan?.maxEmployees || 50,
      maxManagers: org.plan?.maxManagers || 10,
      addDays: 30,
    });
    setShowSubscriptionModal(true);
  };

  const handleUpdateSubscription = async (e) => {
    e.preventDefault();
    if (!selectedOrg) return;
    try {
      const res = await API.patch(`/superadmin/organizations/${selectedOrg._id}/subscription`, subData);
      if (res.data?.success) {
        toast.success(`Subscription updated for ${selectedOrg.name}!`);
        setShowSubscriptionModal(false);
        fetchSuperAdminData();
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

  const filteredPayments = payments.filter((pay) => {
    const orgName = pay.organization?.name || pay.notes?.companyName || '';
    const email = pay.organization?.email || pay.notes?.userEmail || '';
    const matchesSearch =
      orgName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pay.razorpayOrderId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pay.razorpayPaymentId?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = paymentStatusFilter === 'all' || pay.status === paymentStatusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <TrackProLayout>
      <div className="space-y-6 pb-12">
        {/* Modern Super Admin Header Bar */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 rounded-md">
                Super Admin Console
              </span>
              <span className="text-xs text-slate-400 font-semibold">Master Platform Hub</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-1 tracking-tight">
              Platform & Razorpay Payment Hub
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
              Manage multi-tenant organizations, live Razorpay transactions, subscription plans, and tenant quotas.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => fetchSuperAdminData()}
              className="p-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200 shadow-xs transition"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" /> Add Organization
            </button>
          </div>
        </div>

        {/* Multi-Screen Tab Navigation Bar */}
        <div className="flex items-center gap-2 border-b border-slate-200 bg-white p-2 rounded-2xl shadow-xs overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Activity className="w-4 h-4" /> Platform Overview
          </button>

          <button
            onClick={() => setActiveTab('organizations')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'organizations'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-4 h-4" /> Organizations ({organizations.length})
          </button>

          <button
            onClick={() => setActiveTab('payments')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'payments'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <CreditCard className="w-4 h-4" /> Razorpay Payment Ledger
          </button>

          <button
            onClick={() => setActiveTab('plans')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'plans'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Zap className="w-4 h-4" /> SaaS Pricing Plans
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Settings className="w-4 h-4" /> System Settings & Keys
          </button>
        </div>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* SCREEN 1: OVERVIEW DASHBOARD */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* KPI Summary Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Total Revenue */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-bold uppercase tracking-wider">Total Revenue</span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <CreditCard className="w-4 h-4" />
                  </div>
                </div>
                <h3 className="text-2xl font-black text-slate-900 mt-2">₹{(stats.totalRevenue || paymentSummary.totalRevenue || 0).toLocaleString('en-IN')}</h3>
                <span className="text-[11px] text-emerald-600 font-bold block mt-1">
                  From {stats.paidTransactionsCount || paymentSummary.paidCount} Verified Payments
                </span>
              </div>

              {/* Total Organizations */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-bold uppercase tracking-wider">Organizations</span>
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Building2 className="w-4 h-4" />
                  </div>
                </div>
                <h3 className="text-2xl font-black text-slate-900 mt-2">{stats.totalOrgs || organizations.length}</h3>
                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 mt-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {stats.activeOrgs} Active Customers
                </span>
              </div>

              {/* Field Employees */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-bold uppercase tracking-wider">Field Employees</span>
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <h3 className="text-2xl font-black text-slate-900 mt-2">{stats.totalEmployees}</h3>
                <span className="text-xs text-slate-500 font-semibold block mt-1">Across all active orgs</span>
              </div>

              {/* Total Managers */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-bold uppercase tracking-wider">Managers</span>
                  <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                </div>
                <h3 className="text-2xl font-black text-slate-900 mt-2">{stats.totalManagers}</h3>
                <span className="text-xs text-purple-600 font-semibold block mt-1">Assigned Team Leaders</span>
              </div>

              {/* Global Telemetry Distance */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-bold uppercase tracking-wider">Tracked Distance</span>
                  <div className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center">
                    <Activity className="w-4 h-4" />
                  </div>
                </div>
                <h3 className="text-2xl font-black text-slate-900 mt-2">
                  {stats.totalDistanceTracked ? stats.totalDistanceTracked.toLocaleString('en-IN') : '0'} <span className="text-xs font-semibold text-slate-400">km</span>
                </h3>
                <span className="text-xs text-cyan-600 font-semibold block mt-1">Global GPS Telemetry</span>
              </div>
            </div>

            {/* Quick Overview Split Section */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Recent Organizations */}
              <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Recent Customer Organizations</h2>
                    <p className="text-xs text-slate-500">Newly onboarded SaaS tenants & subscriptions</p>
                  </div>
                  <button
                    onClick={() => setActiveTab('organizations')}
                    className="text-xs font-bold text-rose-600 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    View All <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-2.5">
                  {organizations.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                      <Building2 className="w-8 h-8 mx-auto opacity-30 mb-2" />
                      <p className="font-bold text-xs text-slate-600">No Organizations Onboarded</p>
                    </div>
                  ) : (
                    organizations.slice(0, 5).map((org) => (
                      <div key={org._id} className="p-3.5 rounded-xl border border-slate-100 hover:bg-slate-50 flex items-center justify-between transition">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 font-black flex items-center justify-center text-xs border border-indigo-100">
                            {org.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-xs sm:text-sm">{org.name}</div>
                            <div className="text-[11px] text-slate-500">{org.email} • {org.phone}</div>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {org.plan?.planName || 'Growth Pro'}
                          </span>
                          <div className="text-[10px] font-bold text-emerald-600 mt-1">
                            Paid: ₹{(org.totalRevenuePaid || 0).toLocaleString('en-IN')}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Right Column: Recent Payments Feed */}
              <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Live Razorpay Activity</h2>
                    <p className="text-xs text-slate-500">Real-time payment transactions</p>
                  </div>
                  <button
                    onClick={() => setActiveTab('payments')}
                    className="text-xs font-bold text-emerald-600 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    View Ledger <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-2.5">
                  {payments.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                      <CreditCard className="w-8 h-8 mx-auto opacity-30 mb-2" />
                      <p className="font-bold text-xs text-slate-600">No Razorpay Transactions Yet</p>
                      <p className="text-[11px] mt-0.5">Live payments will appear here in real-time.</p>
                    </div>
                  ) : (
                    payments.slice(0, 5).map((pay) => (
                      <div key={pay._id} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                        <div>
                          <div className="text-xs font-black text-slate-900">
                            {pay.organization?.name || pay.notes?.userName || pay.notes?.userEmail || 'Subscription Checkout'}
                          </div>
                          <div className="text-[10px] font-mono text-slate-500">{pay.razorpayOrderId}</div>
                        </div>

                        <div className="text-right">
                          <div className="text-xs font-black text-emerald-600">₹{pay.amount.toLocaleString('en-IN')}</div>
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${pay.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                            {pay.status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* SCREEN 2: ORGANIZATIONS MANAGEMENT */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'organizations' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Customer Organizations Table</h2>
                <p className="text-xs text-slate-500">Manage tenant subscriptions, user limits, status, and custom renewals.</p>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Search org, email, slug..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
                    <th className="py-3.5 px-6">Organization</th>
                    <th className="py-3.5 px-6">Plan & Limit</th>
                    <th className="py-3.5 px-6">Active Users</th>
                    <th className="py-3.5 px-6">Total Paid</th>
                    <th className="py-3.5 px-6">Expires At</th>
                    <th className="py-3.5 px-6">Status</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm font-semibold">
                  {filteredOrgs.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-12 text-center text-slate-400 font-normal">
                        No organizations found matching search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredOrgs.map((org) => (
                      <tr key={org._id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-4 px-6 text-slate-900">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm">
                              {org.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900">{org.name}</div>
                              <div className="text-xs text-slate-500 font-normal">{org.email} • {org.phone}</div>
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-6">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {org.plan?.planName || 'Growth Pro'}
                          </span>
                          <div className="text-xs text-slate-500 mt-0.5">
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
                          {org.plan?.expiresAt ? new Date(org.plan.expiresAt).toLocaleDateString('en-IN') : 'Lifetime / Active'}
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
                              onClick={() => handleOpenSubscriptionModal(org)}
                              className="px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition"
                            >
                              Edit Plan
                            </button>

                            {org.status === 'active' ? (
                              <button
                                onClick={() => handleStatusChange(org._id, 'suspended')}
                                className="px-3 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition"
                              >
                                Suspend
                              </button>
                            ) : (
                              <button
                                onClick={() => handleStatusChange(org._id, 'active')}
                                className="px-3 py-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition"
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
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* SCREEN 3: PAYMENTS & RAZORPAY LEDGER */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'payments' && (
          <div className="space-y-6">
            {/* Razorpay Ledger Summary Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs font-bold text-slate-500 uppercase">Total Revenue</span>
                <h4 className="text-2xl font-black text-emerald-600 mt-1">₹{paymentSummary.totalRevenue.toLocaleString('en-IN')}</h4>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs font-bold text-slate-500 uppercase">Successful Payments</span>
                <h4 className="text-2xl font-black text-slate-900 mt-1">{paymentSummary.paidCount}</h4>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs font-bold text-slate-500 uppercase">Failed Attempts</span>
                <h4 className="text-2xl font-black text-rose-600 mt-1">{paymentSummary.failedCount}</h4>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs font-bold text-slate-500 uppercase">Avg Order Value</span>
                <h4 className="text-2xl font-black text-indigo-600 mt-1">₹{paymentSummary.avgOrderValue.toLocaleString('en-IN')}</h4>
              </div>
            </div>

            {/* Transactions Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Razorpay Live Transaction Ledger</h2>
                  <p className="text-xs text-slate-500">Every Razorpay payment processed for tenant subscriptions</p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="Search order ID, email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 w-64"
                    />
                  </div>

                  <select
                    value={paymentStatusFilter}
                    onChange={(e) => setPaymentStatusFilter(e.target.value)}
                    className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="all">All Payment Status</option>
                    <option value="paid">Paid</option>
                    <option value="created">Created</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
                      <th className="py-3.5 px-6">Razorpay Order / Payment ID</th>
                      <th className="py-3.5 px-6">Organization</th>
                      <th className="py-3.5 px-6">Plan & Cycle</th>
                      <th className="py-3.5 px-6">Amount</th>
                      <th className="py-3.5 px-6">Date</th>
                      <th className="py-3.5 px-6">Status</th>
                      <th className="py-3.5 px-6 text-right">Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm font-semibold">
                    {filteredPayments.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="py-12 text-center text-slate-400 font-normal">
                          No transaction records found.
                        </td>
                      </tr>
                    ) : (
                      filteredPayments.map((pay) => (
                        <tr key={pay._id} className="hover:bg-slate-50 transition">
                          <td className="py-4 px-6 font-mono text-xs">
                            <div className="text-slate-900 font-bold">{pay.razorpayOrderId}</div>
                            <div className="text-slate-400 text-[11px]">{pay.razorpayPaymentId || 'N/A'}</div>
                          </td>

                          <td className="py-4 px-6">
                            <div className="text-slate-900 font-bold">
                              {pay.organization?.name || pay.notes?.companyName || 'SaaS Customer'}
                            </div>
                            <div className="text-xs text-slate-500 font-normal">
                              {pay.organization?.email || pay.notes?.userEmail || ''}
                            </div>
                          </td>

                          <td className="py-4 px-6">
                            <span className="uppercase text-xs font-extrabold px-2.5 py-0.5 rounded bg-slate-100 text-slate-700">
                              {pay.plan} ({pay.billingCycle || 'monthly'})
                            </span>
                          </td>

                          <td className="py-4 px-6 font-black text-emerald-600">
                            ₹{pay.amount.toLocaleString('en-IN')}
                          </td>

                          <td className="py-4 px-6 text-xs text-slate-500 font-normal">
                            {new Date(pay.createdAt).toLocaleString('en-IN')}
                          </td>

                          <td className="py-4 px-6">
                            {pay.status === 'paid' && (
                              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                Paid
                              </span>
                            )}
                            {pay.status === 'created' && (
                              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                Pending
                              </span>
                            )}
                            {pay.status === 'failed' && (
                              <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                Failed
                              </span>
                            )}
                          </td>

                          <td className="py-4 px-6 text-right">
                            <button
                              onClick={() => {
                                setSelectedReceipt(pay);
                                setShowReceiptModal(true);
                              }}
                              className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                              title="View Payment Receipt Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* SCREEN 4: PRICING PLANS CONTROL */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'plans' && (
          <div className="space-y-6">
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center justify-between text-amber-900 text-xs font-bold">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <span>
                  Subscription Access Enforcement: Direct Razorpay Paid Subscriptions ONLY. (Zero Day Access Trial Policy Enforced).
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Starter Plan */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-5">
                <div>
                  <span className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-extrabold rounded-full uppercase">
                    Starter Plan
                  </span>
                  <div className="mt-4 text-3xl font-black text-slate-900">
                    ₹999 <span className="text-xs font-normal text-slate-500">/ month</span>
                  </div>
                  <p className="text-xs text-slate-500 font-semibold mt-1">Ideal for small field teams</p>
                  <ul className="mt-4 space-y-2 text-xs font-semibold text-slate-600">
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-600" /> Up to 10 Employee Accounts</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-600" /> Live GPS Location Telemetry</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-600" /> Selfie Geofenced Attendance</li>
                  </ul>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-500">
                  <span>Quota: 10 Seats</span>
                  <span className="text-emerald-600">Razorpay Active</span>
                </div>
              </div>

              {/* Growth Pro Plan */}
              <div className="bg-gradient-to-b from-indigo-50 to-white p-6 rounded-3xl border-2 border-indigo-500 shadow-md flex flex-col justify-between space-y-5 relative">
                <div className="absolute -top-3 right-6 bg-indigo-600 text-white text-[10px] font-black uppercase px-3 py-1 rounded-full shadow">
                  Most Popular
                </div>

                <div>
                  <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-extrabold rounded-full uppercase">
                    Growth Pro Plan
                  </span>
                  <div className="mt-4 text-3xl font-black text-slate-900">
                    ₹2,999 <span className="text-xs font-normal text-slate-500">/ month</span>
                  </div>
                  <p className="text-xs text-indigo-900 font-semibold mt-1">For growing medium enterprises</p>
                  <ul className="mt-4 space-y-2 text-xs font-semibold text-slate-700">
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-indigo-600" /> Up to 50 Employee Accounts</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-indigo-600" /> 1-Second Live High Precision GPS</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-indigo-600" /> OCR Fuel Expense Audits</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-indigo-600" /> Client Visit Management</li>
                  </ul>
                </div>

                <div className="pt-4 border-t border-indigo-100 flex items-center justify-between text-xs font-bold text-indigo-900">
                  <span>Quota: 50 Seats</span>
                  <span className="text-emerald-600">Razorpay Active</span>
                </div>
              </div>

              {/* Enterprise Plan */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-5">
                <div>
                  <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-extrabold rounded-full uppercase">
                    Enterprise Plan
                  </span>
                  <div className="mt-4 text-3xl font-black text-slate-900">
                    ₹7,999 <span className="text-xs font-normal text-slate-500">/ month</span>
                  </div>
                  <p className="text-xs text-slate-500 font-semibold mt-1">Large scale corporate fleets</p>
                  <ul className="mt-4 space-y-2 text-xs font-semibold text-slate-600">
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-purple-600" /> 500+ Employee Capacity</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-purple-600" /> Dedicated Database & Cloud SLA</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-purple-600" /> Custom API & Telegram Bots</li>
                  </ul>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-500">
                  <span>Quota: 500 Seats</span>
                  <span className="text-emerald-600">Razorpay Active</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* SCREEN 5: SYSTEM SETTINGS & GATEWAY STATUS */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Razorpay Gateway Live Card */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <CreditCard className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Razorpay Live API Integration</h3>
                  <span className="text-xs text-emerald-600 font-bold">Operational • Live Account</span>
                </div>
              </div>

              <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs font-semibold">
                <div className="flex justify-between">
                  <span className="text-slate-500">Key ID:</span>
                  <span className="font-mono font-bold text-slate-900">rzp_live_TNdSmDOKSX2g6I</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">HMAC SHA256 Signature Verification:</span>
                  <span className="font-bold text-emerald-600">ENFORCED</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Currency:</span>
                  <span className="font-bold text-slate-900">INR (Indian Rupee)</span>
                </div>
              </div>
            </div>

            {/* Platform Control & Support */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <PhoneCall className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Platform Support & Hotline</h3>
                  <span className="text-xs text-slate-500 font-medium">Customer Service Contact</span>
                </div>
              </div>

              <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs font-semibold">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Support Phone:</span>
                  <a href="tel:9511450914" className="font-black text-indigo-600 hover:underline text-sm">
                    +91 9511450914
                  </a>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Multi-Tenant Isolation:</span>
                  <span className="font-bold text-emerald-600">ACTIVE</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Access Mode:</span>
                  <span className="font-bold text-slate-900">Organization Registration Only</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* MODAL 1: ADD ORGANIZATION MODAL */}
        {/* ════════════════════════════════════════════════════════════════ */}
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

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* MODAL 2: EDIT SUBSCRIPTION MODAL */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {showSubscriptionModal && selectedOrg && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-slate-200">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Update Subscription</h3>
                  <p className="text-xs text-slate-500">For {selectedOrg.name}</p>
                </div>
                <button onClick={() => setShowSubscriptionModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>

              <form onSubmit={handleUpdateSubscription} className="space-y-4 text-sm font-semibold">
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
                    onClick={() => setShowSubscriptionModal(false)}
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

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* MODAL 3: RECEIPT MODAL */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {showReceiptModal && selectedReceipt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-slate-200">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Razorpay Payment Receipt</h3>
                  <p className="text-xs font-mono text-slate-500">{selectedReceipt.razorpayOrderId}</p>
                </div>
                <button onClick={() => setShowReceiptModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>

              <div className="space-y-3 text-xs font-semibold bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div className="flex justify-between">
                  <span className="text-slate-500">Organization:</span>
                  <span className="font-bold text-slate-900">
                    {selectedReceipt.organization?.name || selectedReceipt.notes?.companyName || 'SaaS Customer'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Amount Paid:</span>
                  <span className="font-black text-emerald-600 text-sm">
                    ₹{selectedReceipt.amount.toLocaleString('en-IN')} INR
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Razorpay Payment ID:</span>
                  <span className="font-mono text-slate-900">{selectedReceipt.razorpayPaymentId || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status:</span>
                  <span className="font-bold uppercase text-emerald-600">{selectedReceipt.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Paid At:</span>
                  <span>{new Date(selectedReceipt.createdAt).toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setShowReceiptModal(false)}
                  className="px-5 py-2 bg-slate-900 text-white rounded-xl font-bold"
                >
                  Close Receipt
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </TrackProLayout>
  );
}
