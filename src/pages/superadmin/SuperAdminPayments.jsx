import React, { useState, useEffect } from 'react';
import KisanConnectLayout from '../../components/layout/KisanConnectLayout';
import {
  CreditCard,
  Search,
  RefreshCw,
  Eye,
  CheckCircle2,
  XCircle,
  Tag,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Percent,
  Calendar,
  Sparkles,
  Copy,
  Receipt,
  AlertCircle,
  Check,
  X,
} from 'lucide-react';
import { API } from '../../services/api.service';
import toast from 'react-hot-toast';

export default function SuperAdminPayments() {
  const [activeTab, setActiveTab] = useState('ledger'); // 'ledger' | 'coupons'

  // ==========================================
  // 1. PAYMENT TRANSACTIONS LEDGER STATE
  // ==========================================
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState({
    totalRevenue: 0,
    paidCount: 0,
    failedCount: 0,
    createdCount: 0,
    avgOrderValue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // ==========================================
  // 2. COUPONS STATE
  // ==========================================
  const [coupons, setCoupons] = useState([]);
  const [loadingCoupons, setLoadingCoupons] = useState(false);
  const [couponSearch, setCouponSearch] = useState('');
  const [showCreateCouponModal, setShowCreateCouponModal] = useState(false);
  const [creatingCoupon, setCreatingCoupon] = useState(false);

  const [couponForm, setCouponForm] = useState({
    code: '',
    description: '',
    discountType: 'percentage', // 'percentage' | 'flat'
    discountValue: 10,
    minOrderAmount: '',
    maxDiscountAmount: '',
    maxUses: 100,
    validTill: '',
  });

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const res = await API.get('/superadmin/payments');
      if (res.data?.success) {
        setPayments(res.data.payments || []);
        if (res.data.summary) setSummary(res.data.summary);
      }
    } catch (error) {
      toast.error('Failed to load payment transactions ledger');
    } finally {
      setLoading(false);
    }
  };

  const fetchCoupons = async () => {
    try {
      setLoadingCoupons(true);
      const res = await API.get('/superadmin/coupons');
      if (res.data?.success) {
        setCoupons(res.data.coupons || []);
      }
    } catch (error) {
      toast.error('Failed to fetch coupons');
    } finally {
      setLoadingCoupons(false);
    }
  };

  useEffect(() => {
    fetchPayments();
    fetchCoupons();
  }, []);

  // Filtered Payments
  const filteredPayments = payments.filter((pay) => {
    const orgName = pay.organization?.name || pay.notes?.companyName || '';
    const email = pay.organization?.email || pay.notes?.userEmail || '';
    const matchesSearch =
      orgName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pay.razorpayOrderId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pay.razorpayPaymentId?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || pay.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Filtered Coupons
  const filteredCoupons = coupons.filter((c) => {
    const code = c.code || '';
    const desc = c.description || '';
    return (
      code.toLowerCase().includes(couponSearch.toLowerCase()) ||
      desc.toLowerCase().includes(couponSearch.toLowerCase())
    );
  });

  // Handle Create Coupon
  const handleCreateCoupon = async (e) => {
    e.preventDefault();
    if (!couponForm.code.trim()) {
      toast.error('Coupon code is required.');
      return;
    }
    if (!couponForm.discountValue || Number(couponForm.discountValue) <= 0) {
      toast.error('Discount value must be greater than zero.');
      return;
    }

    try {
      setCreatingCoupon(true);
      const payload = {
        code: couponForm.code.trim().toUpperCase(),
        description: couponForm.description,
        discountType: couponForm.discountType,
        discountValue: Number(couponForm.discountValue),
        minOrderAmount: couponForm.minOrderAmount ? Number(couponForm.minOrderAmount) : 0,
        maxDiscountAmount: couponForm.maxDiscountAmount ? Number(couponForm.maxDiscountAmount) : null,
        maxUses: couponForm.maxUses ? Number(couponForm.maxUses) : 100,
        validTill: couponForm.validTill ? new Date(couponForm.validTill).toISOString() : null,
      };

      const res = await API.post('/superadmin/coupons', payload);
      if (res.data?.success) {
        toast.success(`Coupon "${payload.code}" created successfully! 🎉`);
        setShowCreateCouponModal(false);
        setCouponForm({
          code: '',
          description: '',
          discountType: 'percentage',
          discountValue: 10,
          minOrderAmount: '',
          maxDiscountAmount: '',
          maxUses: 100,
          validTill: '',
        });
        fetchCoupons();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create coupon.');
    } finally {
      setCreatingCoupon(false);
    }
  };

  // Handle Toggle Coupon Status
  const handleToggleCoupon = async (id, currentStatus, code) => {
    try {
      const res = await API.patch(`/superadmin/coupons/${id}/toggle`);
      if (res.data?.success) {
        toast.success(`Coupon ${code} is now ${!currentStatus ? 'Active' : 'Inactive'}`);
        setCoupons((prev) =>
          prev.map((c) => (c._id === id ? { ...c, isActive: !currentStatus } : c))
        );
      }
    } catch (err) {
      toast.error('Failed to toggle coupon status');
    }
  };

  // Handle Delete Coupon
  const handleDeleteCoupon = async (id, code) => {
    if (!window.confirm(`Are you sure you want to permanently delete coupon "${code}"?`)) return;
    try {
      const res = await API.delete(`/superadmin/coupons/${id}`);
      if (res.data?.success) {
        toast.success(`Coupon "${code}" deleted successfully.`);
        setCoupons((prev) => prev.filter((c) => c._id !== id));
      }
    } catch (err) {
      toast.error('Failed to delete coupon');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success(`Copied "${text}" to clipboard! 📋`);
  };

  return (
    <KisanConnectLayout>
      <div className="space-y-6 pb-12">
        {/* Modern Super Admin Header Bar */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-emerald-600" /> Razorpay Live Gateway
              </span>
              <span className="text-xs text-slate-400 font-semibold">Live Subscription Revenue & Coupons</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-1 tracking-tight">
              Razorpay Financial Hub & Discount Coupons
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
              Verify Razorpay payment orders, audit HMAC signatures, and manage discount promo coupons for client checkouts.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                fetchPayments();
                fetchCoupons();
              }}
              className="p-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200 shadow-xs transition cursor-pointer flex items-center gap-2 text-xs font-bold"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading || loadingCoupons ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 gap-4">
          <button
            onClick={() => setActiveTab('ledger')}
            className={`pb-3 px-2 text-sm font-black flex items-center gap-2 border-b-2 transition ${
              activeTab === 'ledger'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Payment Ledger & Orders ({payments.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('coupons')}
            className={`pb-3 px-2 text-sm font-black flex items-center gap-2 border-b-2 transition ${
              activeTab === 'coupons'
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Tag className="w-4 h-4" />
            <span>Discount Coupons Manager ({coupons.length})</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: PAYMENT TRANSACTIONS LEDGER                                        */}
        {/* ========================================================================= */}
        {activeTab === 'ledger' && (
          <div className="space-y-6">
            {/* Financial KPI Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 text-white p-5 rounded-2xl shadow-md">
                <span className="text-xs font-black text-emerald-200 uppercase tracking-wider">Total Revenue</span>
                <h4 className="text-3xl font-black mt-1">₹{summary.totalRevenue.toLocaleString('en-IN')}</h4>
                <span className="text-[11px] text-emerald-100 font-bold block mt-1">Live Verified INR</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Successful Orders</span>
                <h4 className="text-3xl font-black text-slate-900 mt-1">{summary.paidCount}</h4>
                <span className="text-xs font-bold text-emerald-600 block mt-1">Status: Paid</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Failed Transactions</span>
                <h4 className="text-3xl font-black text-rose-600 mt-1">{summary.failedCount}</h4>
                <span className="text-xs text-rose-500 font-semibold block mt-1">Invalid or Dismissed</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Avg Order Value</span>
                <h4 className="text-3xl font-black text-indigo-600 mt-1">₹{summary.avgOrderValue.toLocaleString('en-IN')}</h4>
                <span className="text-xs text-indigo-600 font-semibold block mt-1">Per Organization</span>
              </div>
            </div>

            {/* Toolbar */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  placeholder="Search by Razorpay Order ID, email, company..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 font-semibold"
                />
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-500 uppercase">Payment Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold text-slate-800"
                >
                  <option value="all">All Transactions ({payments.length})</option>
                  <option value="paid">Paid Only</option>
                  <option value="created">Pending / Created</option>
                  <option value="failed">Failed Only</option>
                </select>
              </div>
            </div>

            {/* Transactions Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
                      <th className="py-4 px-6">Razorpay Order & Payment ID</th>
                      <th className="py-4 px-6">Organization Customer</th>
                      <th className="py-4 px-6">Subscription Plan</th>
                      <th className="py-4 px-6">Amount (INR)</th>
                      <th className="py-4 px-6">Payment Timestamp</th>
                      <th className="py-4 px-6">Status</th>
                      <th className="py-4 px-6 text-right">View Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm font-semibold">
                    {filteredPayments.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="py-12 text-center text-slate-400 font-normal">
                          No payment transactions found.
                        </td>
                      </tr>
                    ) : (
                      filteredPayments.map((pay) => (
                        <tr key={pay._id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-4 px-6 font-mono text-xs">
                            <div className="text-slate-900 font-bold">{pay.razorpayOrderId}</div>
                            <div className="text-slate-400 text-[11px] mt-0.5">{pay.razorpayPaymentId || 'N/A'}</div>
                          </td>

                          <td className="py-4 px-6">
                            <div className="text-slate-900 font-bold">
                              {pay.organization?.name || pay.notes?.companyName || 'SaaS Org'}
                            </div>
                            <div className="text-xs text-slate-500 font-normal">
                              {pay.organization?.email || pay.notes?.userEmail || 'N/A'}
                            </div>
                          </td>

                          <td className="py-4 px-6">
                            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200 capitalize">
                              {pay.planName || 'Pro'} ({pay.billingCycle || 'Yearly - 5% OFF'})
                            </span>
                          </td>

                          <td className="py-4 px-6 font-mono text-emerald-600 font-black">
                            ₹{pay.amount?.toLocaleString('en-IN')}
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
                              className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                              title="View Digital Receipt"
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

        {/* ========================================================================= */}
        {/* TAB 2: DISCOUNT COUPONS MANAGER                                           */}
        {/* ========================================================================= */}
        {activeTab === 'coupons' && (
          <div className="space-y-6">
            {/* Coupons KPI Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-rose-500 to-rose-700 text-white p-5 rounded-2xl shadow-md">
                <span className="text-xs font-black text-rose-100 uppercase tracking-wider">Total Coupons</span>
                <h4 className="text-3xl font-black mt-1">{coupons.length}</h4>
                <span className="text-[11px] text-rose-200 font-bold block mt-1">Configured in Database</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Coupons</span>
                <h4 className="text-3xl font-black text-emerald-600 mt-1">
                  {coupons.filter((c) => c.isActive).length}
                </h4>
                <span className="text-xs font-bold text-emerald-600 block mt-1">Available for checkout</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Redemptions</span>
                <h4 className="text-3xl font-black text-indigo-600 mt-1">
                  {coupons.reduce((sum, c) => sum + (c.usedCount || 0), 0)}
                </h4>
                <span className="text-xs font-bold text-indigo-600 block mt-1">Used by Organizations</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Yearly Default</span>
                  <h4 className="text-2xl font-black text-amber-600 mt-1">SAVE 5% OFF</h4>
                </div>
                <span className="text-[11px] font-semibold text-slate-500">Auto-applied on Yearly Billing</span>
              </div>
            </div>

            {/* Coupons Toolbar */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  placeholder="Search coupons by code or description..."
                  value={couponSearch}
                  onChange={(e) => setCouponSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-900 font-semibold"
                />
              </div>

              <button
                onClick={() => setShowCreateCouponModal(true)}
                className="bg-rose-600 hover:bg-rose-700 text-white font-black px-5 py-2.5 rounded-xl text-sm shadow-md transition active:scale-95 flex items-center gap-2 justify-center cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                Create New Coupon
              </button>
            </div>

            {/* Coupons Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
                      <th className="py-4 px-6">Coupon Code</th>
                      <th className="py-4 px-6">Discount Offer</th>
                      <th className="py-4 px-6">Min Order</th>
                      <th className="py-4 px-6">Redemptions</th>
                      <th className="py-4 px-6">Valid Till</th>
                      <th className="py-4 px-6">Status</th>
                      <th className="py-4 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm font-semibold">
                    {filteredCoupons.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="py-12 text-center text-slate-400 font-normal">
                          {loadingCoupons ? 'Loading coupons...' : 'No coupons found. Click "+ Create New Coupon" to add one!'}
                        </td>
                      </tr>
                    ) : (
                      filteredCoupons.map((c) => {
                        const isExpired = c.validTill && new Date(c.validTill) < new Date();
                        return (
                          <tr key={c._id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-black text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg text-sm tracking-wide">
                                  {c.code}
                                </span>
                                <button
                                  onClick={() => copyToClipboard(c.code)}
                                  className="text-slate-400 hover:text-slate-600 p-1"
                                  title="Copy Code"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              {c.description && (
                                <p className="text-xs text-slate-500 font-normal mt-1">{c.description}</p>
                              )}
                            </td>

                            <td className="py-4 px-6">
                              <div className="font-bold text-slate-900">
                                {c.discountType === 'percentage'
                                  ? `${c.discountValue}% OFF`
                                  : `₹${c.discountValue.toLocaleString('en-IN')} Flat OFF`}
                              </div>
                              {c.maxDiscountAmount && (
                                <div className="text-[11px] text-slate-500 font-normal">
                                  Cap: ₹{c.maxDiscountAmount} max
                                </div>
                              )}
                            </td>

                            <td className="py-4 px-6 text-xs text-slate-700">
                              {c.minOrderAmount ? `₹${c.minOrderAmount.toLocaleString('en-IN')}` : 'No minimum'}
                            </td>

                            <td className="py-4 px-6 text-xs">
                              <span className="font-bold text-slate-900">{c.usedCount || 0}</span>
                              <span className="text-slate-400"> / {c.maxUses || '∞'} uses</span>
                            </td>

                            <td className="py-4 px-6 text-xs">
                              {c.validTill ? (
                                <span className={isExpired ? 'text-rose-600 font-bold' : 'text-slate-700'}>
                                  {new Date(c.validTill).toLocaleDateString('en-IN')}
                                  {isExpired && ' (Expired)'}
                                </span>
                              ) : (
                                <span className="text-emerald-600 font-bold">No Expiry</span>
                              )}
                            </td>

                            <td className="py-4 px-6">
                              <button
                                onClick={() => handleToggleCoupon(c._id, c.isActive, c.code)}
                                className={`px-3 py-1 rounded-full text-xs font-bold border cursor-pointer transition ${
                                  c.isActive
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200'
                                    : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                                }`}
                              >
                                {c.isActive ? 'Active' : 'Disabled'}
                              </button>
                            </td>

                            <td className="py-4 px-6 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleToggleCoupon(c._id, c.isActive, c.code)}
                                  className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                                  title={c.isActive ? 'Disable Coupon' : 'Enable Coupon'}
                                >
                                  {c.isActive ? (
                                    <ToggleRight className="w-5 h-5 text-emerald-600" />
                                  ) : (
                                    <ToggleLeft className="w-5 h-5 text-slate-400" />
                                  )}
                                </button>
                                <button
                                  onClick={() => handleDeleteCoupon(c._id, c.code)}
                                  className="p-1.5 text-rose-500 hover:text-rose-700 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                                  title="Delete Coupon"
                                >
                                  <Trash2 className="w-4 h-4" />
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
          </div>
        )}

        {/* ========================================================================= */}
        {/* CREATE COUPON MODAL                                                       */}
        {/* ========================================================================= */}
        {showCreateCouponModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-slate-200 my-8">
              <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                    <Tag className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">Create Discount Coupon</h3>
                    <p className="text-xs text-slate-500">Add a promo code for user checkout</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCreateCouponModal(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateCoupon} className="space-y-4">
                {/* Coupon Code */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Coupon Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. WELCOME20, FESTIVE500"
                    value={couponForm.code}
                    onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono font-bold text-slate-900 uppercase"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Exclusive 20% discount on Yearly Pro subscriptions"
                    value={couponForm.description}
                    onChange={(e) => setCouponForm({ ...couponForm, description: e.target.value })}
                    className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-900"
                  />
                </div>

                {/* Discount Type & Value */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Discount Type
                    </label>
                    <select
                      value={couponForm.discountType}
                      onChange={(e) => setCouponForm({ ...couponForm, discountType: e.target.value })}
                      className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 font-semibold text-slate-900"
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="flat">Flat Amount (₹)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      {couponForm.discountType === 'percentage' ? 'Percentage (%) *' : 'Amount (₹) *'}
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      max={couponForm.discountType === 'percentage' ? '100' : '100000'}
                      placeholder={couponForm.discountType === 'percentage' ? '20' : '500'}
                      value={couponForm.discountValue}
                      onChange={(e) => setCouponForm({ ...couponForm, discountValue: e.target.value })}
                      className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 font-bold text-slate-900"
                    />
                  </div>
                </div>

                {/* Min Order & Max Discount */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Min Order (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="e.g. 1000"
                      value={couponForm.minOrderAmount}
                      onChange={(e) => setCouponForm({ ...couponForm, minOrderAmount: e.target.value })}
                      className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Max Discount Cap (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="e.g. 2000"
                      value={couponForm.maxDiscountAmount}
                      onChange={(e) => setCouponForm({ ...couponForm, maxDiscountAmount: e.target.value })}
                      disabled={couponForm.discountType === 'flat'}
                      className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-900 disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Max Uses & Valid Till */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Usage Limit
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="100"
                      value={couponForm.maxUses}
                      onChange={(e) => setCouponForm({ ...couponForm, maxUses: e.target.value })}
                      className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-900 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Valid Till (Date)
                    </label>
                    <input
                      type="date"
                      value={couponForm.validTill}
                      onChange={(e) => setCouponForm({ ...couponForm, validTill: e.target.value })}
                      className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-900"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t">
                  <button
                    type="button"
                    onClick={() => setShowCreateCouponModal(false)}
                    className="px-4 py-2.5 text-slate-600 hover:text-slate-800 text-sm font-semibold rounded-xl hover:bg-slate-100 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingCoupon}
                    className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-sm rounded-xl shadow-md transition disabled:opacity-50 flex items-center gap-2"
                  >
                    {creatingCoupon ? 'Creating...' : 'Create Coupon'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* RECEIPT MODAL                                                             */}
        {/* ========================================================================= */}
        {showReceiptModal && selectedReceipt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-slate-200">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Razorpay Payment Receipt</h3>
                  <p className="text-xs font-mono text-slate-500">{selectedReceipt.razorpayOrderId}</p>
                </div>
                <button
                  onClick={() => setShowReceiptModal(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs font-semibold bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div className="flex justify-between">
                  <span className="text-slate-500">Customer Organization:</span>
                  <span className="font-bold text-slate-900">
                    {selectedReceipt.organization?.name || selectedReceipt.notes?.companyName || 'SaaS Customer'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Plan & Cycle:</span>
                  <span className="font-bold capitalize text-slate-900">
                    {selectedReceipt.planName} ({selectedReceipt.billingCycle})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Amount Paid:</span>
                  <span className="font-black text-emerald-600 text-sm">
                    ₹{selectedReceipt.amount?.toLocaleString('en-IN')} INR
                  </span>
                </div>
                {selectedReceipt.notes?.couponCode && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Coupon Applied:</span>
                    <span className="font-mono text-rose-600 font-bold">{selectedReceipt.notes.couponCode}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Razorpay Payment ID:</span>
                  <span className="font-mono text-slate-900">{selectedReceipt.razorpayPaymentId || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">HMAC Signature Verification:</span>
                  <span className="font-bold text-emerald-600">HMAC SHA256 PASSED</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Status:</span>
                  <span className="font-bold uppercase text-emerald-600">{selectedReceipt.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Date & Time:</span>
                  <span>{new Date(selectedReceipt.createdAt).toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setShowReceiptModal(false)}
                  className="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition cursor-pointer"
                >
                  Close Receipt
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </KisanConnectLayout>
  );
}
