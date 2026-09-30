import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import TrackProLayout from '../../components/layout/TrackProLayout';
import {
  CreditCard,
  CheckCircle,
  AlertTriangle,
  Zap,
  ShieldCheck,
  Calendar,
  Users,
  Sparkles,
  Tag,
  ArrowRight,
  Download,
  Receipt,
  Clock,
  Check,
  X,
  RefreshCw,
  UserPlus,
  Plus,
  Minus,
  Briefcase,
  Layers,
} from 'lucide-react';
import { initiateRazorpayCheckout } from '../../utils/razorpay';
import axios from 'axios';
import toast from 'react-hot-toast';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

export default function AdminBilling() {
  const { user, organization, refreshUser } = useAuth();

  const [billingCycle, setBillingCycle] = useState('yearly'); // Default to Yearly (Save 5%)
  const [selectedPlan, setSelectedPlan] = useState('pro');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // Seat Top-Up Add-on State (₹200/employee, ₹300/manager)
  const [addonEmployeeSeats, setAddonEmployeeSeats] = useState(1);
  const [addonManagerSeats, setAddonManagerSeats] = useState(0);
  const [addonCheckoutLoading, setAddonCheckoutLoading] = useState(false);

  // Payment History
  const [payments, setPayments] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  // Default Pricing configuration with exact Yearly SAVE 5% OFF
  const defaultPlans = {
    starter: {
      id: 'starter',
      name: 'Starter Plan',
      description: 'Ideal for small teams starting field monitoring',
      monthlyPrice: 999,
      yearlyPrice: 11389,
      yearlyOriginal: 11988,
      yearlySavings: 599,
      maxEmployees: 10,
      maxManagers: 3,
      features: [
        'Up to 10 Field Employees',
        '3 Manager Accounts',
        'Real-time GPS Tracking & Speed',
        'Daily Punch-In & Attendance',
        'Attendance Calendar & History',
        'Standard Email Support',
      ],
      color: 'blue',
    },
    pro: {
      id: 'pro',
      name: 'Growth Pro Plan',
      description: 'Full field automation with manager squads & approvals',
      monthlyPrice: 1999,
      yearlyPrice: 22789,
      yearlyOriginal: 23988,
      yearlySavings: 1199,
      maxEmployees: 30,
      maxManagers: 10,
      popular: true,
      features: [
        'Up to 30 Field Employees',
        '10 Manager Accounts',
        'Live Route Replay & Geofencing',
        'Dynamic Manager Squad Assignment',
        'Expense Claim & Fuel DA Approvals',
        'Client Meeting Logging & Geocoding',
        'Task Assignment & Daily Targets',
        'Instant Push Notifications',
        'Priority Phone & Chat Support',
      ],
      color: 'emerald',
    },
    enterprise: {
      id: 'enterprise',
      name: 'Enterprise Plan',
      description: 'Unlimited power & scaling for high capacity operations',
      monthlyPrice: 3999,
      yearlyPrice: 45589,
      yearlyOriginal: 47988,
      yearlySavings: 2399,
      maxEmployees: 50,
      maxManagers: 20,
      features: [
        'Up to 50 Field Employees',
        '20 Manager Accounts',
        'Unlimited Geofence Zones & Polling',
        'Automated Payroll & DA Calculator',
        'Custom Data Exports (Excel, PDF)',
        'Full Multi-Department Hierarchy',
        'Dedicated Technical Account Manager',
        '24/7 VIP Phone Support & Custom SLA',
      ],
      color: 'purple',
    },
  };

  const [plans, setPlans] = useState(defaultPlans);

  // Fetch dynamic plans from server
  useEffect(() => {
    const fetchLivePlans = async () => {
      try {
        const res = await axios.get(`${API_URL}/payment/plans`);
        if (res.data?.success && Array.isArray(res.data.plans)) {
          const mapped = { ...defaultPlans };
          res.data.plans.forEach((p) => {
            const pid = p.planId || (p.name.toLowerCase().includes('starter') ? 'starter' : p.name.toLowerCase().includes('enterprise') ? 'enterprise' : 'pro');
            const rawFeatures = Array.isArray(p.features) && p.features.length > 0 ? p.features : (mapped[pid]?.features || []);
            const alignedFeatures = rawFeatures.map((f) => {
              if (/^Up to \d+ (Field )?Employee/i.test(f) || /^\d+ Employee Accounts/i.test(f)) {
                return `Up to ${p.maxEmployees} Field Employee Accounts`;
              }
              if (/^\d+ Manager Accounts/i.test(f) || /^Up to \d+ Manager/i.test(f)) {
                return `${p.maxManagers} Manager Accounts`;
              }
              return f;
            });

            mapped[pid] = {
              id: pid,
              name: p.name,
              description: p.description || mapped[pid]?.description,
              monthlyPrice: p.priceMonthly,
              yearlyPrice: p.priceYearly || Math.round(p.priceMonthly * 12 * 0.95),
              yearlyOriginal: p.priceMonthly * 12,
              yearlySavings: (p.priceMonthly * 12) - (p.priceYearly || Math.round(p.priceMonthly * 12 * 0.95)),
              maxEmployees: p.maxEmployees,
              maxManagers: p.maxManagers,
              features: alignedFeatures,
              popular: Boolean(p.isPopular),
              color: pid === 'starter' ? 'blue' : pid === 'enterprise' ? 'purple' : 'emerald',
            };
          });
          setPlans(mapped);
        }
      } catch (err) {
        // Fallback to defaults
      }
    };
    fetchLivePlans();
  }, []);

  const currentOrg = organization || user?.organizationId || {};
  const currentPlanName = currentOrg?.plan?.planName || 'No Active Plan';
  const expiresAt = currentOrg?.plan?.expiresAt ? new Date(currentOrg.plan.expiresAt) : null;
  const isPlanActive =
    currentOrg?.status === 'active' && expiresAt && expiresAt > new Date();

  const daysRemaining = expiresAt
    ? Math.max(0, Math.ceil((expiresAt - new Date()) / (1000 * 60 * 60 * 24)))
    : 0;

  // Fetch Payment History
  const fetchPaymentHistory = async () => {
    try {
      setLoadingHistory(true);
      const token = localStorage.getItem('token');
      const orgId = currentOrg?._id || currentOrg?.id;
      const res = await axios.get(`${API_URL}/payment/history`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { organizationId: orgId },
      });
      if (res.data?.success) {
        setPayments(res.data.payments || []);
      }
    } catch (err) {
      console.error('Failed to fetch payment history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchPaymentHistory();
  }, [currentOrg?._id]);

  // Calculate pricing based on selected plan, billing cycle, and coupon
  const activePlanData = plans[selectedPlan] || plans.pro;
  const originalAmount =
    billingCycle === 'yearly' ? activePlanData.yearlyPrice : activePlanData.monthlyPrice;

  let discountAmount = appliedCoupon ? appliedCoupon.discount : 0;
  const payableAmount = Math.max(1, originalAmount - discountAmount);

  // Apply Coupon Handler
  const handleApplyCoupon = async (e) => {
    e.preventDefault();
    if (!couponCode.trim()) {
      toast.error('Please enter a coupon code.');
      return;
    }

    setCouponLoading(true);
    try {
      const res = await axios.post(`${API_URL}/payment/apply-coupon`, {
        couponCode: couponCode.trim(),
        plan: selectedPlan,
        billingCycle,
      });

      if (res.data?.success) {
        setAppliedCoupon(res.data);
        toast.success(res.data.message || `Coupon "${couponCode.toUpperCase()}" applied!`);
      }
    } catch (err) {
      setAppliedCoupon(null);
      toast.error(err.response?.data?.message || 'Invalid or expired coupon code.');
    } finally {
      setCouponLoading(false);
    }
  };

  // Remove Coupon
  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    toast('Coupon removed.');
  };

  // Addon pricing calculations (₹200/employee, ₹300/manager)
  const addonEmployeePrice = addonEmployeeSeats * 200;
  const addonManagerPrice = addonManagerSeats * 300;
  const totalAddonAmount = addonEmployeePrice + addonManagerPrice;

  // Launch Razorpay Checkout for Extra Staff Seats (Top-Up)
  const handleAddonCheckout = async () => {
    if (!isPlanActive) {
      toast.error(
        '⚠️ Cannot purchase add-on seats! Your subscription plan is inactive or expired. Please activate/renew your Starter, Pro, or Enterprise plan first.'
      );
      const planSection = document.getElementById('subscription-plans-section');
      if (planSection) planSection.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    if (totalAddonAmount <= 0) {
      toast.error('Please select at least 1 employee or manager seat to top-up.');
      return;
    }
    setAddonCheckoutLoading(true);
    try {
      const orgId = currentOrg?._id || currentOrg?.id || '';
      const addonPlanType =
        addonEmployeeSeats > 0 && addonManagerSeats > 0
          ? 'seat_addon'
          : addonManagerSeats > 0
          ? 'manager_addon'
          : 'employee_addon';

      await initiateRazorpayCheckout({
        plan: addonPlanType,
        billingCycle: 'onetime',
        seats: addonEmployeeSeats + addonManagerSeats,
        employeeSeats: addonEmployeeSeats,
        managerSeats: addonManagerSeats,
        addonType: addonEmployeeSeats > 0 && addonManagerSeats > 0 ? 'combo' : addonManagerSeats > 0 ? 'manager' : 'employee',
        organizationId: orgId,
        userName: user?.name || 'Organization Admin',
        userEmail: user?.email || currentOrg?.email || '',
        userPhone: user?.phone || currentOrg?.phone || '9511450914',
        companyName: currentOrg?.name || 'TrackPro Organization',
        onSuccess: async (verifyRes) => {
          setAddonCheckoutLoading(false);
          toast.success(verifyRes?.message || '🎉 Top-up successful! Extra seats added to your account.');
          if (refreshUser) await refreshUser();
          fetchPaymentHistory();
        },
        onFailure: (err) => {
          setAddonCheckoutLoading(false);
          toast.error(err.message || 'Seat purchase cancelled or incomplete.');
        },
      });
    } catch (err) {
      setAddonCheckoutLoading(false);
      toast.error(err.message || 'Failed to initiate seat top-up.');
    }
  };

  // Launch Live Razorpay Checkout for Full Plan
  const handleCheckout = async () => {
    setCheckoutLoading(true);
    try {
      const orgId = currentOrg?._id || currentOrg?.id || '';

      await initiateRazorpayCheckout({
        plan: selectedPlan,
        billingCycle,
        organizationId: orgId,
        userName: user?.name || 'Organization Admin',
        userEmail: user?.email || currentOrg?.email || '',
        userPhone: user?.phone || currentOrg?.phone || '9511450914',
        companyName: currentOrg?.name || 'TrackPro Organization',
        couponCode: appliedCoupon ? appliedCoupon.couponCode : '',
        onSuccess: async (verifyRes) => {
          setCheckoutLoading(false);
          toast.success('🎉 Payment verified and plan activated successfully!');
          if (refreshUser) await refreshUser();
          fetchPaymentHistory();
        },
        onFailure: (err) => {
          setCheckoutLoading(false);
          toast.error(err.message || 'Payment cancelled or incomplete.');
        },
      });
    } catch (err) {
      setCheckoutLoading(false);
      toast.error(err.message || 'Failed to initiate payment.');
    }
  };

  const getPlanDisplayName = (pay) => {
    if (!pay) return 'PRO PLAN';
    if (pay.plan === 'employee_addon') {
      return `Employee Top-Up (+${pay.employeeSeats || pay.seats || 1} Seats)`;
    }
    if (pay.plan === 'manager_addon') {
      return `Manager Top-Up (+${pay.managerSeats || pay.seats || 1} Seats)`;
    }
    if (pay.plan === 'seat_addon' || pay.plan === 'addon') {
      const parts = [];
      if (pay.employeeSeats > 0) parts.push(`+${pay.employeeSeats} Emp`);
      if (pay.managerSeats > 0) parts.push(`+${pay.managerSeats} Mgr`);
      return `Seat Top-Up (${parts.join(', ') || `+${pay.seats} Seats`})`;
    }
    return `${(pay.plan || 'PRO').toUpperCase()} PLAN`;
  };

  return (
    <TrackProLayout>
      <div className="space-y-8 max-w-7xl mx-auto pb-12">
        {/* Page Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <CreditCard className="w-7 h-7 text-emerald-600" />
              Subscription & Plan Management
            </h1>
            <p className="text-sm text-slate-500 font-medium mt-1">
              Manage your company's active SaaS plan, quotas, invoices, and payment billing history.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (refreshUser) refreshUser();
                fetchPaymentHistory();
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm cursor-pointer"
            >
              <RefreshCw className="w-4 h-4 text-slate-500" />
              <span>Refresh Status</span>
            </button>
          </div>
        </div>

        {/* 1. CURRENT PLAN STATUS HERO CARD */}
        <div
          className={`p-6 sm:p-8 rounded-3xl border ${
            isPlanActive
              ? 'bg-gradient-to-br from-emerald-50 via-teal-50/40 to-white border-emerald-200'
              : 'bg-gradient-to-br from-rose-50 via-orange-50/30 to-white border-rose-200'
          } shadow-sm relative overflow-hidden`}
        >
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                    isPlanActive
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-rose-600 text-white shadow-xs'
                  }`}
                >
                  {isPlanActive ? (
                    <>
                      <CheckCircle className="w-3.5 h-3.5" />
                      Active Subscription
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5" />
                      No Active Plan / Unpaid
                    </>
                  )}
                </span>

                <span className="text-xs font-bold text-slate-500 bg-white/80 px-3 py-1 rounded-full border border-slate-200/80">
                  Org: <strong className="text-slate-800">{currentOrg?.name || 'Your Company'}</strong>
                </span>
              </div>

              <h2 className="text-3xl font-black text-slate-900 tracking-tight">
                {isPlanActive ? currentPlanName : 'No Active Plan'}
              </h2>

              <p className="text-sm text-slate-600 font-medium max-w-2xl">
                {isPlanActive
                  ? 'Your subscription is active with full platform, telemetry, and tracking access.'
                  : 'Choose a subscription plan below to activate your organization workspace.'}
              </p>
            </div>

            {/* Metrics Pill Grid */}
            <div className="flex flex-wrap sm:flex-nowrap gap-4 w-full lg:w-auto">
              <div className="bg-white/90 backdrop-blur-xs p-4 rounded-2xl border border-slate-200/80 min-w-[140px] shadow-sm">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-bold mb-1">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                  <span>Days Left</span>
                </div>
                <div className="text-2xl font-black text-slate-900">
                  {daysRemaining} <span className="text-xs text-slate-400 font-bold">Days</span>
                </div>
                <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                  {expiresAt ? `Expires on ${expiresAt.toLocaleDateString()}` : 'Not activated'}
                </div>
              </div>

              <div className="bg-white/90 backdrop-blur-xs p-4 rounded-2xl border border-slate-200/80 min-w-[140px] shadow-sm">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-bold mb-1">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span>Staff Quota</span>
                </div>
                <div className="text-2xl font-black text-slate-900">
                  {currentOrg?.plan?.maxEmployees || 0}
                </div>
                <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                  Max field employees allowed
                </div>
              </div>

              <div className="bg-white/90 backdrop-blur-xs p-4 rounded-2xl border border-slate-200/80 min-w-[140px] shadow-sm">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-bold mb-1">
                  <Briefcase className="w-4 h-4 text-purple-600" />
                  <span>Manager Quota</span>
                </div>
                <div className="text-2xl font-black text-slate-900">
                  {currentOrg?.plan?.maxManagers || 0}
                </div>
                <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                  Max managers allowed
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ⚡ 2. QUICK SEAT ADD-ON TOP-UP (₹200/EMP, ₹300/MGR) */}
        <div
          className={`rounded-3xl p-6 sm:p-8 border-2 shadow-md relative overflow-hidden transition-all ${
            isPlanActive
              ? 'bg-gradient-to-br from-white via-indigo-50/20 to-purple-50/30 border-indigo-100'
              : 'bg-slate-50/90 border-slate-200'
          }`}
        >
          {/* Active / Inactive Plan Context Banner */}
          {!isPlanActive ? (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-amber-900 shadow-xs">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                    Active Base Plan Required
                  </h4>
                  <p className="text-xs text-amber-800 font-medium">
                    Seat add-ons attach to an active base plan. Please select a plan below.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  const sec = document.getElementById('subscription-plans-section');
                  if (sec) sec.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition cursor-pointer shrink-0 flex items-center gap-1.5 shadow-xs"
              >
                <span>View Plans</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>Base Plan: <strong>{currentPlanName}</strong></span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 text-xs font-bold">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>Valid until <strong>{expiresAt?.toLocaleDateString()}</strong> ({daysRemaining}d left)</span>
              </div>
            </div>
          )}

          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pb-6 border-b border-indigo-100/80">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-600 text-white text-[11px] font-bold uppercase tracking-wider shadow-xs">
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                Seat Add-Ons
              </div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">
                Buy Individual Staff Quota
              </h3>
              <p className="text-xs text-slate-600 font-medium max-w-2xl">
                Add extra employee (₹200/seat) or manager (₹300/seat) quota to your active subscription.
              </p>
            </div>

            {/* Price badge */}
            <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-2xl border border-indigo-200/80 shadow-xs">
              <div className="text-right">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Addon Subtotal</div>
                <div className="text-2xl font-black text-indigo-600">₹{totalAddonAmount}</div>
              </div>
            </div>
          </div>

          {/* Stepper Controls Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
            {/* Employee Seat Stepper */}
            <div className={`p-5 rounded-2xl border shadow-sm space-y-4 ${isPlanActive ? 'bg-white border-slate-200/90' : 'bg-white/60 border-slate-200 opacity-80'}`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900">Field Employee Seats</h4>
                      <p className="text-[11px] font-bold text-blue-600">₹200 / Employee Seat</p>
                    </div>
                  </div>
                </div>

                <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                  Current: <strong>{currentOrg?.plan?.maxEmployees || 0}</strong>
                </span>
              </div>

              {/* Counter Buttons */}
              <div className="flex items-center justify-between gap-4 pt-2">
                <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50 p-1">
                  <button
                    type="button"
                    onClick={() => setAddonEmployeeSeats(Math.max(0, addonEmployeeSeats - 1))}
                    disabled={!isPlanActive || addonEmployeeSeats <= 0}
                    className="w-9 h-9 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 font-black text-slate-700 flex items-center justify-center transition cursor-pointer shadow-sm"
                  >
                    <Minus className="w-4 h-4" />
                  </button>

                  <input
                    type="number"
                    min="0"
                    max="500"
                    disabled={!isPlanActive}
                    value={addonEmployeeSeats}
                    onChange={(e) => setAddonEmployeeSeats(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-16 text-center font-black text-base text-slate-900 bg-transparent focus:outline-none disabled:opacity-50"
                  />

                  <button
                    type="button"
                    onClick={() => setAddonEmployeeSeats(addonEmployeeSeats + 1)}
                    disabled={!isPlanActive}
                    className="w-9 h-9 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 font-black text-slate-700 flex items-center justify-center transition cursor-pointer shadow-sm"
                  >
                    <Plus className="w-4 h-4 text-emerald-600" />
                  </button>
                </div>

                {/* Quick Add Chips */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[1, 5, 10, 20].map((num) => (
                    <button
                      key={num}
                      type="button"
                      disabled={!isPlanActive}
                      onClick={() => setAddonEmployeeSeats((prev) => prev + num)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-100 hover:text-indigo-700 text-slate-700 text-xs font-bold transition disabled:opacity-40 cursor-pointer"
                    >
                      +{num}
                    </button>
                  ))}
                  {addonEmployeeSeats > 0 && isPlanActive && (
                    <button
                      type="button"
                      onClick={() => setAddonEmployeeSeats(0)}
                      className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition cursor-pointer"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              {/* Subtotal & Quota Projection */}
              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                <span className="text-slate-500 font-medium">
                  {addonEmployeeSeats} seat(s) × ₹200 = <strong className="text-slate-900 font-bold">₹{addonEmployeePrice}</strong>
                </span>
                <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                  New Quota: {(currentOrg?.plan?.maxEmployees || 0) + addonEmployeeSeats} Seats
                </span>
              </div>
            </div>

            {/* Manager Account Stepper */}
            <div className={`p-5 rounded-2xl border shadow-sm space-y-4 ${isPlanActive ? 'bg-white border-slate-200/90' : 'bg-white/60 border-slate-200 opacity-80'}`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                      <Briefcase className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900">Manager Accounts</h4>
                      <p className="text-[11px] font-bold text-purple-600">₹300 / Manager Seat</p>
                    </div>
                  </div>
                </div>

                <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                  Current: <strong>{currentOrg?.plan?.maxManagers || 0}</strong>
                </span>
              </div>

              {/* Counter Buttons */}
              <div className="flex items-center justify-between gap-4 pt-2">
                <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50 p-1">
                  <button
                    type="button"
                    onClick={() => setAddonManagerSeats(Math.max(0, addonManagerSeats - 1))}
                    disabled={!isPlanActive || addonManagerSeats <= 0}
                    className="w-9 h-9 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 font-black text-slate-700 flex items-center justify-center transition cursor-pointer shadow-sm"
                  >
                    <Minus className="w-4 h-4" />
                  </button>

                  <input
                    type="number"
                    min="0"
                    max="100"
                    disabled={!isPlanActive}
                    value={addonManagerSeats}
                    onChange={(e) => setAddonManagerSeats(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-16 text-center font-black text-base text-slate-900 bg-transparent focus:outline-none disabled:opacity-50"
                  />

                  <button
                    type="button"
                    onClick={() => setAddonManagerSeats(addonManagerSeats + 1)}
                    disabled={!isPlanActive}
                    className="w-9 h-9 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 font-black text-slate-700 flex items-center justify-center transition cursor-pointer shadow-sm"
                  >
                    <Plus className="w-4 h-4 text-purple-600" />
                  </button>
                </div>

                {/* Quick Add Chips */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[1, 2, 5, 10].map((num) => (
                    <button
                      key={num}
                      type="button"
                      disabled={!isPlanActive}
                      onClick={() => setAddonManagerSeats((prev) => prev + num)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-purple-100 hover:text-purple-700 text-slate-700 text-xs font-bold transition disabled:opacity-40 cursor-pointer"
                    >
                      +{num}
                    </button>
                  ))}
                  {addonManagerSeats > 0 && isPlanActive && (
                    <button
                      type="button"
                      onClick={() => setAddonManagerSeats(0)}
                      className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition cursor-pointer"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              {/* Subtotal & Quota Projection */}
              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                <span className="text-slate-500 font-medium">
                  {addonManagerSeats} seat(s) × ₹300 = <strong className="text-slate-900 font-bold">₹{addonManagerPrice}</strong>
                </span>
                <span className="font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">
                  New Quota: {(currentOrg?.plan?.maxManagers || 0) + addonManagerSeats} Seats
                </span>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="mt-6 pt-5 border-t border-indigo-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-500 font-medium flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                {isPlanActive
                  ? `Seats are added immediately to your plan and remain valid until ${expiresAt?.toLocaleDateString()}.`
                  : 'Add-on purchases require an active subscription plan.'}
              </span>
            </div>

            {!isPlanActive ? (
              <button
                type="button"
                onClick={() => {
                  toast.error('Please choose and activate a subscription plan first.');
                  const sec = document.getElementById('subscription-plans-section');
                  if (sec) sec.scrollIntoView({ behavior: 'smooth' });
                }}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm transition active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
              >
                <AlertTriangle className="w-4 h-4 text-amber-200" />
                <span>Activate Base Plan First</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleAddonCheckout}
                disabled={addonCheckoutLoading || totalAddonAmount <= 0}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition active:scale-98 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {addonCheckoutLoading ? (
                  <span>Processing Checkout...</span>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4 text-amber-300" />
                    <span>
                      Add {addonEmployeeSeats + addonManagerSeats} Seat(s) • ₹{totalAddonAmount}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* 3. BILLING CYCLE TOGGLE (YEARLY SAVE 5% OFF) */}
        <div id="subscription-plans-section" className="text-center space-y-4 pt-4 scroll-mt-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-extrabold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            Special Subscription Discount Available
          </div>

          <h3 className="text-2xl font-black text-slate-900">
            Choose Your Subscription Plan
          </h3>
          <p className="text-sm text-slate-500 font-medium max-w-lg mx-auto">
            Upgrade or renew seamlessly. All plans include 100% data isolation, live GPS route telemetry, and full mobile integration.
          </p>

          {/* Toggle pill */}
          <div className="flex items-center justify-center gap-3 pt-2">
            <div className="inline-flex p-1.5 bg-slate-100 rounded-2xl border border-slate-200/90 shadow-inner">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`px-6 py-2.5 rounded-xl text-xs font-black transition cursor-pointer ${
                  billingCycle === 'monthly'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Monthly Billing
              </button>

              <button
                type="button"
                onClick={() => setBillingCycle('yearly')}
                className={`px-6 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
                  billingCycle === 'yearly'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Yearly Billing</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider ${
                    billingCycle === 'yearly'
                      ? 'bg-amber-400 text-amber-950 font-black'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  SAVE 5% OFF
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* 3. PLAN CARDS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          {Object.values(plans).map((p) => {
            const isSelected = selectedPlan === p.id;
            const price = billingCycle === 'yearly' ? p.yearlyPrice : p.monthlyPrice;

            return (
              <div
                key={p.id}
                onClick={() => setSelectedPlan(p.id)}
                className={`relative rounded-3xl p-6 sm:p-7 border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'border-emerald-600 bg-white shadow-xl shadow-emerald-600/10 ring-4 ring-emerald-500/10'
                    : 'border-slate-200 bg-white hover:border-slate-300 shadow-xs'
                }`}
              >
                {p.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[11px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-300" />
                    Most Popular
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <h4 className="text-xl font-black text-slate-900">{p.name}</h4>
                    <p className="text-xs text-slate-500 font-medium mt-1">{p.description}</p>
                  </div>

                  {/* Price */}
                  <div className="pt-2">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-4xl font-black text-slate-900">₹{price}</span>
                      <span className="text-xs text-slate-500 font-bold">
                        / {billingCycle === 'yearly' ? 'year' : 'month'}
                      </span>
                    </div>

                    {billingCycle === 'yearly' && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-400 line-through">
                          ₹{p.yearlyOriginal}
                        </span>
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                          Save ₹{p.yearlySavings} (5% OFF)
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Features list */}
                  <ul className="space-y-2.5 pt-4 border-t border-slate-100 text-xs font-semibold text-slate-600">
                    {p.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-6">
                  <button
                    type="button"
                    onClick={() => setSelectedPlan(p.id)}
                    className={`w-full py-3 px-4 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-2 ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <span>{isSelected ? 'Selected Plan' : 'Select Plan'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* 4. COUPON CODE & CHECKOUT SUMMARY */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            {/* Coupon Code Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-slate-800 text-sm font-black">
                <Tag className="w-4 h-4 text-emerald-600" />
                <span>Apply Promo / Coupon Code</span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Got a promotional coupon code from your administrator or account representative? Apply it below to claim an instant discount.
              </p>

              <form onSubmit={handleApplyCoupon} className="flex items-center gap-2 max-w-md">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Enter Coupon Code (e.g. WELCOME50)"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    disabled={appliedCoupon !== null}
                    className="w-full pl-4 pr-4 py-3 text-xs font-bold uppercase tracking-wider bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 placeholder:text-slate-400 placeholder:normal-case transition disabled:opacity-60"
                  />
                </div>

                {appliedCoupon ? (
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    className="px-4 py-3 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-black transition flex items-center gap-1 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                    <span>Remove</span>
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={couponLoading || !couponCode.trim()}
                    className="px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black transition disabled:opacity-50 cursor-pointer"
                  >
                    {couponLoading ? 'Applying...' : 'Apply Coupon'}
                  </button>
                )}
              </form>

              {appliedCoupon && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    Coupon <strong>"{appliedCoupon.couponCode}"</strong> applied! Discount: ₹{appliedCoupon.discount}
                  </span>
                </div>
              )}
            </div>

            {/* Order Summary & Razorpay Pay Button */}
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200/80 space-y-4">
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Order & Billing Summary
              </h4>

              <div className="space-y-2 text-xs font-semibold text-slate-600 divide-y divide-slate-200/60">
                <div className="flex justify-between py-1.5">
                  <span>Selected Subscription:</span>
                  <strong className="text-slate-900">
                    {activePlanData.name} ({billingCycle.toUpperCase()})
                  </strong>
                </div>

                <div className="flex justify-between py-1.5">
                  <span>Subtotal Amount:</span>
                  <span className="font-bold text-slate-800">₹{originalAmount}</span>
                </div>

                {billingCycle === 'yearly' && (
                  <div className="flex justify-between py-1.5 text-emerald-700 font-bold">
                    <span>Yearly Billing Savings (5% OFF):</span>
                    <span>-₹{activePlanData.yearlySavings}</span>
                  </div>
                )}

                {appliedCoupon && (
                  <div className="flex justify-between py-1.5 text-emerald-700 font-bold">
                    <span>Coupon Discount ({appliedCoupon.couponCode}):</span>
                    <span>-₹{discountAmount}</span>
                  </div>
                )}

                <div className="flex justify-between pt-3 text-base font-black text-slate-900">
                  <span>Total Payable Amount:</span>
                  <span className="text-xl text-emerald-600 font-black">₹{payableAmount}</span>
                </div>
              </div>

              {/* Pay with Razorpay Button */}
              <button
                type="button"
                onClick={handleCheckout}
                disabled={checkoutLoading}
                className="w-full py-4 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-lg shadow-emerald-600/25 transition active:scale-98 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {checkoutLoading ? (
                  <span>Processing Razorpay Checkout...</span>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4 text-amber-300" />
                    <span>PAY ₹{payableAmount} VIA RAZORPAY NOW</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400 font-semibold text-center">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>256-bit Bank Grade SSL Security • Instant Subscription Activation</span>
              </div>
            </div>
          </div>
        </div>

        {/* 5. PAYMENT & TRANSACTION INVOICE HISTORY */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-600" />
                Transaction & Invoice History
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Full ledger of past subscriptions and payments for this organization.
              </p>
            </div>
          </div>

          {loadingHistory ? (
            <div className="py-8 text-center text-xs font-bold text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
              <span>Loading payment ledger...</span>
            </div>
          ) : payments.length === 0 ? (
            <div className="py-8 text-center bg-slate-50 rounded-2xl border border-slate-200/80">
              <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-500">No payment transactions found.</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Once you complete your first subscription checkout, invoices will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-semibold">
                <thead className="bg-slate-50 text-slate-500 font-extrabold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Plan</th>
                    <th className="py-3 px-4">Billing Cycle</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Razorpay Order ID</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Invoice</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {payments.map((pay) => {
                    const payDate = new Date(pay.paidAt || pay.createdAt).toLocaleDateString('en-IN', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    });

                    return (
                      <tr key={pay._id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 px-4 font-bold text-slate-900">{payDate}</td>
                        <td className="py-3.5 px-4 uppercase font-extrabold text-slate-800">
                          {getPlanDisplayName(pay)}
                        </td>
                        <td className="py-3.5 px-4 capitalize">{pay.billingCycle || 'monthly'}</td>
                        <td className="py-3.5 px-4 font-black text-slate-900">₹{pay.amount}</td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                          {pay.razorpayOrderId || 'N/A'}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              pay.status === 'paid'
                                ? 'bg-emerald-100 text-emerald-800'
                                : pay.status === 'failed'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {pay.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedInvoice(pay)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>View</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 6. PROFESSIONAL TAX INVOICE & RECEIPT MODAL */}
        {selectedInvoice && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 border border-slate-200 shadow-2xl relative space-y-5 my-8">
              {/* Invoice Header */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md">
                      OFFICIAL TAX INVOICE
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-400">
                      INV-{selectedInvoice._id.slice(-8).toUpperCase()}
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">
                    TrackPro Subscription Receipt
                  </h3>
                  <p className="text-xs text-slate-500">
                    Billed by TrackPro SaaS Services • KisanConnect Inc.
                  </p>
                </div>

                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Billed To & Billed Date Grid */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 font-bold uppercase text-[10px] block mb-1">
                    Billed To:
                  </span>
                  <div className="font-bold text-slate-900 text-sm">
                    {currentOrg?.name || selectedInvoice.notes?.companyName || user?.name || 'Customer Organization'}
                  </div>
                  <div className="text-slate-500 text-[11px] mt-0.5">
                    {user?.email || currentOrg?.email || selectedInvoice.notes?.userEmail}
                  </div>
                  <div className="text-slate-500 text-[11px]">
                    Phone: {user?.phone || currentOrg?.phone || '9511450914'}
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 font-bold uppercase text-[10px] block mb-1">
                    Payment Telemetry:
                  </span>
                  <div className="text-slate-700 font-semibold">
                    Date: <strong className="text-slate-900">{new Date(selectedInvoice.paidAt || selectedInvoice.createdAt).toLocaleString('en-IN')}</strong>
                  </div>
                  <div className="text-slate-700 font-semibold mt-0.5">
                    Order ID: <span className="font-mono text-[11px]">{selectedInvoice.razorpayOrderId}</span>
                  </div>
                  <div className="text-slate-700 font-semibold mt-0.5">
                    Payment ID: <span className="font-mono text-[11px] text-indigo-600">{selectedInvoice.razorpayPaymentId || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-extrabold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4">Plan Item / Description</th>
                      <th className="py-2.5 px-4">Cycle</th>
                      <th className="py-2.5 px-4 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                    <tr>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 uppercase">
                          {getPlanDisplayName(selectedInvoice)}
                        </div>
                        <div className="text-[11px] text-slate-500 font-normal">
                          {['employee_addon', 'manager_addon', 'seat_addon', 'addon'].includes(selectedInvoice.plan)
                            ? 'Instant Organization Quota Top-Up (Direct staff addition)'
                            : 'Live GPS Tracking, Geofence Attendance & Manager Hierarchy'}
                        </div>
                      </td>
                      <td className="py-3 px-4 capitalize font-bold">
                        {selectedInvoice.billingCycle || 'Monthly'}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-slate-900">
                        ₹{selectedInvoice.amount?.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Financial Totals */}
              <div className="space-y-2 text-xs font-semibold text-slate-600 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex justify-between">
                  <span>Gross Amount:</span>
                  <span className="font-bold text-slate-900">₹{selectedInvoice.amount}</span>
                </div>
                {selectedInvoice.notes?.couponCode && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Coupon Applied ({selectedInvoice.notes.couponCode}):</span>
                    <span>Discount Included</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Taxes (GST 0% Included):</span>
                  <span>₹0.00</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-black text-slate-900">
                  <span>Total Amount Paid:</span>
                  <span className="text-emerald-600 text-lg">₹{selectedInvoice.amount?.toLocaleString('en-IN')} INR</span>
                </div>
              </div>

              {/* Verification & Paid Stamp */}
              <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs font-bold text-emerald-800">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>Verified via Razorpay Live Gateway (HMAC Signature Verified)</span>
                </div>
                <span className="bg-emerald-600 text-white px-2 py-0.5 rounded text-[10px] font-black uppercase">
                  PAID
                </span>
              </div>

              {/* Footer Actions */}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black transition cursor-pointer flex items-center justify-center gap-2 shadow-md"
                >
                  <Download className="w-4 h-4" />
                  <span>Print / Save Tax Invoice</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedInvoice(null)}
                  className="px-6 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </TrackProLayout>
  );
}
