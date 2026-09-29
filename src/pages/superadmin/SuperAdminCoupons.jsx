import React, { useState, useEffect } from 'react';
import TrackProLayout from '../../components/layout/TrackProLayout';
import {
  Tag,
  Plus,
  Trash2,
  Search,
  RefreshCw,
  Sparkles,
  Percent,
  Calendar,
  Copy,
  CheckCircle2,
  XCircle,
  X,
  CreditCard,
  AlertCircle,
} from 'lucide-react';
import { API } from '../../services/api.service';
import toast from 'react-hot-toast';

export default function SuperAdminCoupons() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);

  const [formData, setFormData] = useState({
    code: '',
    description: '',
    discountType: 'percentage',
    discountValue: 10,
    minOrderAmount: '',
    maxDiscountAmount: '',
    maxUses: 100,
    validTill: '',
  });

  const fetchCoupons = async () => {
    try {
      setLoading(true);
      const res = await API.get('/superadmin/coupons');
      if (res.data?.success) {
        setCoupons(res.data.coupons || []);
      }
    } catch (error) {
      toast.error('Failed to load discount coupons');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  const handleCreateCoupon = async (e) => {
    e.preventDefault();
    if (!formData.code.trim()) {
      toast.error('Coupon code is required');
      return;
    }
    if (!formData.discountValue || Number(formData.discountValue) <= 0) {
      toast.error('Discount value must be greater than 0');
      return;
    }

    try {
      setCreating(true);
      const payload = {
        code: formData.code.trim().toUpperCase(),
        description: formData.description,
        discountType: formData.discountType,
        discountValue: Number(formData.discountValue),
        minOrderAmount: formData.minOrderAmount ? Number(formData.minOrderAmount) : 0,
        maxDiscountAmount: formData.maxDiscountAmount ? Number(formData.maxDiscountAmount) : null,
        maxUses: formData.maxUses ? Number(formData.maxUses) : 100,
        validTill: formData.validTill ? new Date(formData.validTill).toISOString() : null,
      };

      const res = await API.post('/superadmin/coupons', payload);
      if (res.data?.success) {
        toast.success(`🎉 Coupon "${payload.code}" created successfully!`);
        setShowModal(false);
        setFormData({
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
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create coupon');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (couponId) => {
    try {
      const res = await API.patch(`/superadmin/coupons/${couponId}/toggle`);
      if (res.data?.success) {
        toast.success(res.data.message || 'Coupon status updated!');
        fetchCoupons();
      }
    } catch (error) {
      toast.error('Failed to toggle coupon status');
    }
  };

  const handleDeleteCoupon = async (couponId, code) => {
    if (!window.confirm(`Are you sure you want to permanently delete coupon "${code}"?`)) return;
    try {
      const res = await API.delete(`/superadmin/coupons/${couponId}`);
      if (res.data?.success) {
        toast.success(`Coupon "${code}" deleted!`);
        fetchCoupons();
      }
    } catch (error) {
      toast.error('Failed to delete coupon');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success(`Copied "${text}" to clipboard! 📋`);
  };

  const filteredCoupons = coupons.filter((c) => {
    const code = c.code || '';
    const desc = c.description || '';
    return (
      code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      desc.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <TrackProLayout>
      <div className="space-y-6 pb-12">
        {/* Header */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 rounded-md flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-rose-600" /> Promo & Checkout Engine
              </span>
              <span className="text-xs text-slate-400 font-semibold">Razorpay Discount Codes</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-1 tracking-tight">
              Promotional & Discount Coupons Manager
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
              Create and manage promotional discount coupons for organization subscription checkouts.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchCoupons}
              className="p-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200 shadow-xs transition cursor-pointer flex items-center gap-2 text-xs font-bold"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" /> Create Promo Coupon
            </button>
          </div>
        </div>

        {/* Toolbar & Search */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Search coupon code or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-900 font-semibold"
            />
          </div>

          <div className="text-xs font-bold text-slate-500">
            Total Active Coupons: <span className="text-slate-900 font-extrabold">{coupons.filter(c => c.isActive).length}</span> / {coupons.length}
          </div>
        </div>

        {/* Coupons Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCoupons.length === 0 ? (
            <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 font-medium">
              No promo coupons found. Click "+ Create Promo Coupon" to add one.
            </div>
          ) : (
            filteredCoupons.map((coupon) => (
              <div
                key={coupon._id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-black">
                        <Tag className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-base font-black text-slate-900 tracking-wider">
                            {coupon.code}
                          </span>
                          <button
                            onClick={() => copyToClipboard(coupon.code)}
                            className="text-slate-400 hover:text-slate-700 p-1"
                            title="Copy Code"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <span className="text-xs text-slate-500 font-medium line-clamp-1">
                          {coupon.description || 'Special Discount Coupon'}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleToggleStatus(coupon._id)}
                      className={`px-2 py-0.5 rounded-full text-[11px] font-bold border transition ${
                        coupon.isActive
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}
                    >
                      {coupon.isActive ? 'Active' : 'Disabled'}
                    </button>
                  </div>

                  <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-xs font-semibold">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Discount Rate:</span>
                      <span className="text-rose-700 font-extrabold text-sm">
                        {coupon.discountType === 'percentage'
                          ? `${coupon.discountValue}% OFF`
                          : `₹${coupon.discountValue} FLAT OFF`}
                      </span>
                    </div>

                    {coupon.minOrderAmount > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Min Order Value:</span>
                        <span className="text-slate-900 font-bold">₹{coupon.minOrderAmount}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Usage Status:</span>
                      <span className="text-slate-900 font-bold">
                        {coupon.usedCount || 0} / {coupon.maxUses || 'Unlimited'} uses
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Expires:</span>
                      <span className="text-slate-700 font-mono text-[11px]">
                        {coupon.validTill
                          ? new Date(coupon.validTill).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : 'No Expiration'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-medium">
                    Created: {new Date(coupon.createdAt).toLocaleDateString('en-IN')}
                  </span>

                  <button
                    onClick={() => handleDeleteCoupon(coupon._id, coupon.code)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    title="Delete Coupon"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Create Coupon Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                    <Tag className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">Create Promotional Coupon</h3>
                    <p className="text-xs text-slate-500">Configure discount value and redemption limits</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateCoupon} className="space-y-4 mt-4 text-xs font-semibold">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 mb-1">Coupon Code *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. SPECIAL50"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 mb-1">Discount Type *</label>
                    <select
                      value={formData.discountType}
                      onChange={(e) => setFormData({ ...formData, discountType: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 font-bold text-slate-800"
                    >
                      <option value="percentage">Percentage (% OFF)</option>
                      <option value="flat">Flat Amount (₹ INR)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 mb-1">
                      Discount Value {formData.discountType === 'percentage' ? '(%)' : '(₹)'} *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="e.g. 15"
                      value={formData.discountValue}
                      onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 mb-1">Max Redemptions</label>
                    <input
                      type="number"
                      min="1"
                      placeholder="e.g. 100"
                      value={formData.maxUses}
                      onChange={(e) => setFormData({ ...formData, maxUses: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 font-bold text-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 mb-1">Min Order Amount (₹)</label>
                    <input
                      type="number"
                      placeholder="Optional (e.g. 1000)"
                      value={formData.minOrderAmount}
                      onChange={(e) => setFormData({ ...formData, minOrderAmount: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 mb-1">Expiry Date</label>
                    <input
                      type="date"
                      value={formData.validTill}
                      onChange={(e) => setFormData({ ...formData, validTill: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 mb-1">Description / Promo Campaign</label>
                  <input
                    type="text"
                    placeholder="e.g. Festival Season 20% discount on Yearly subscriptions"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-5 py-2 text-white bg-rose-600 hover:bg-rose-700 rounded-xl font-bold shadow-md transition disabled:opacity-50"
                  >
                    {creating ? 'Saving...' : 'Publish Coupon'}
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
