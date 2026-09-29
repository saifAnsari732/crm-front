import React, { useState, useEffect } from 'react';
import TrackProLayout from '../../components/layout/TrackProLayout';
import {
  Zap,
  Check,
  CreditCard,
  ShieldAlert,
  Sliders,
  Users,
  Edit3,
  Layers,
  Plus,
  Trash2,
  X,
  RefreshCw,
  CheckCircle2,
  TrendingUp,
  UserCheck,
  ShieldCheck,
  Building2,
  Crown,
  Briefcase,
  Star,
  CheckCheck,
  HelpCircle,
} from 'lucide-react';
import { API } from '../../services/api.service';
import toast from 'react-hot-toast';

const defaultPlanFallbacks = [
  {
    planId: 'starter',
    name: 'Starter Plan',
    description: 'Ideal for small field teams starting with live GPS tracking',
    badge: 'Starter Tier',
    priceMonthly: 999,
    priceYearly: 11389,
    maxEmployees: 10,
    maxManagers: 3,
    isPopular: false,
    isActive: true,
    features: [
      'Up to 10 Employee Accounts',
      '3 Manager Accounts',
      'Real-Time GPS Location Telemetry',
      'Geofenced Selfie Attendance',
      'Daily Travel Distance Calculation',
      'Standard Email Support',
    ],
  },
  {
    planId: 'pro',
    name: 'Growth Pro Plan',
    description: 'For growing medium enterprises needing high accuracy tracking & audit',
    badge: 'Most Popular',
    priceMonthly: 1999,
    priceYearly: 22789,
    maxEmployees: 30,
    maxManagers: 10,
    isPopular: true,
    isActive: true,
    features: [
      'Up to 30 Employee Accounts',
      '10 Manager Accounts',
      'Live High-Precision Route Replay',
      'Manager Squad Team Assignment',
      'OCR Fuel & Receipt Expense Audits',
      'Client Visit & Meeting Reports',
      'Priority Phone & Chat Support',
    ],
  },
  {
    planId: 'enterprise',
    name: 'Enterprise Plan',
    description: 'High capacity operations requiring multi-tier squad hierarchy',
    badge: 'Full Capacity',
    priceMonthly: 3999,
    priceYearly: 45589,
    maxEmployees: 50,
    maxManagers: 20,
    isPopular: false,
    isActive: true,
    features: [
      'Up to 50 Employee Accounts',
      '20 Manager Accounts',
      'Unlimited Geofence Zones & Polling',
      'Automated Payroll & DA Calculator',
      'Custom Data Exports (Excel, PDF)',
      'Full Multi-Department Hierarchy',
      'Dedicated Technical Account Manager',
      '24/7 VIP Phone Support & Custom SLA',
    ],
  },
];

export default function SuperAdminPlans() {
  const [plans, setPlans] = useState(defaultPlanFallbacks);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' | 'yearly'
  const [syncing, setSyncing] = useState(false);

  // Edit Plan Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [saving, setSaving] = useState(false);

  // Create Plan Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form State
  const [editForm, setEditForm] = useState({
    name: '',
    badge: '',
    description: '',
    priceMonthly: 0,
    priceYearly: 0,
    maxEmployees: 10,
    maxManagers: 3,
    isPopular: false,
    isActive: true,
    features: [],
  });

  const [createForm, setCreateForm] = useState({
    planId: '',
    name: '',
    badge: '',
    description: '',
    priceMonthly: 999,
    priceYearly: 11389,
    maxEmployees: 15,
    maxManagers: 5,
    isPopular: false,
    features: [
      'Up to 15 Employee Accounts',
      '5 Manager Accounts',
      'Real-Time GPS Location Telemetry',
      'Geofenced Selfie Attendance',
      'Daily Travel Distance Calculation',
      'Standard Support',
    ],
  });

  const [newFeatureText, setNewFeatureText] = useState('');

  // Feature suggestions
  const suggestedFeatures = [
    'Real-Time GPS Location Telemetry',
    'Geofenced Selfie Attendance',
    'Daily Travel Distance Calculation',
    'Live High-Precision Route Replay',
    'Manager Squad Team Assignment',
    'OCR Fuel & Receipt Expense Audits',
    'Client Visit & Meeting Reports',
    'Unlimited Geofence Zones & Polling',
    'Automated Payroll & DA Calculator',
    'Custom Data Exports (Excel, PDF)',
    'Full Multi-Department Hierarchy',
    'Dedicated Technical Account Manager',
    '24/7 VIP Phone Support & Custom SLA',
  ];

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const res = await API.get('/superadmin/plans');
      if (res.data?.success && Array.isArray(res.data.plans) && res.data.plans.length > 0) {
        setPlans(res.data.plans);
      }
    } catch (error) {
      // Keep fallbacks
    } finally {
      setLoading(false);
    }
  };

  const handleSyncDefaults = async () => {
    try {
      setSyncing(true);
      const res = await API.post('/superadmin/plans/seed-defaults');
      if (res.data?.success) {
        toast.success('All 3 standard SaaS plans synced successfully!');
        setPlans(res.data.plans || defaultPlanFallbacks);
      }
    } catch (error) {
      toast.error('Failed to sync default plans');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const handleOpenEdit = (plan) => {
    setSelectedPlan(plan);
    setEditForm({
      name: plan.name || '',
      badge: plan.badge || '',
      description: plan.description || '',
      priceMonthly: plan.priceMonthly || 0,
      priceYearly: plan.priceYearly || Math.round((plan.priceMonthly || 0) * 12 * 0.95),
      maxEmployees: plan.maxEmployees || 10,
      maxManagers: plan.maxManagers || 3,
      isPopular: Boolean(plan.isPopular),
      isActive: plan.isActive !== false,
      features: Array.isArray(plan.features) ? [...plan.features] : [],
    });
    setNewFeatureText('');
    setShowEditModal(true);
  };

  const handleAddFeatureToEdit = () => {
    if (!newFeatureText.trim()) return;
    if (editForm.features.includes(newFeatureText.trim())) {
      toast.error('Feature already in list');
      return;
    }
    setEditForm((prev) => ({
      ...prev,
      features: [...prev.features, newFeatureText.trim()],
    }));
    setNewFeatureText('');
  };

  const handleAddSuggestedFeature = (feat) => {
    if (editForm.features.includes(feat)) {
      toast.error('Feature already included');
      return;
    }
    setEditForm((prev) => ({
      ...prev,
      features: [...prev.features, feat],
    }));
    toast.success(`Added "${feat}"`);
  };

  const handleRemoveFeatureFromEdit = (index) => {
    setEditForm((prev) => ({
      ...prev,
      features: prev.features.filter((_, idx) => idx !== index),
    }));
  };

  const handleSavePlan = async (e) => {
    e.preventDefault();
    if (!editForm.name.trim()) {
      toast.error('Plan name cannot be empty');
      return;
    }

    try {
      setSaving(true);
      const planIdentifier = selectedPlan._id || selectedPlan.planId;

      // Auto-align seat count text in features list if present
      const alignedFeatures = (editForm.features || []).map((f) => {
        if (/^Up to \d+ (Field )?Employee/i.test(f) || /^\d+ Employee Accounts/i.test(f)) {
          return `Up to ${editForm.maxEmployees} Employee Accounts`;
        }
        if (/^\d+ Manager Accounts/i.test(f) || /^Up to \d+ Manager/i.test(f)) {
          return `${editForm.maxManagers} Manager Accounts`;
        }
        return f;
      });

      const res = await API.patch(`/superadmin/plans/${planIdentifier}`, {
        ...editForm,
        features: alignedFeatures,
        planId: selectedPlan.planId,
      });

      if (res.data?.success) {
        toast.success(`🎉 Plan "${editForm.name}" updated successfully across all platform pages!`);
        setShowEditModal(false);
        fetchPlans();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save plan changes to database');
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePlan = async (e) => {
    e.preventDefault();
    if (!createForm.name.trim()) {
      toast.error('Plan name is required');
      return;
    }

    try {
      setCreating(true);
      const res = await API.post('/superadmin/plans', createForm);
      if (res.data?.success) {
        toast.success(`Created new plan tier "${createForm.name}"!`);
        setShowCreateModal(false);
        fetchPlans();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create plan');
    } finally {
      setCreating(false);
    }
  };

  const handleDeletePlan = async (plan) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${plan.name}"?`)) return;
    try {
      const res = await API.delete(`/superadmin/plans/${plan._id}`);
      if (res.data?.success) {
        toast.success(`Plan "${plan.name}" deleted!`);
        fetchPlans();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete plan');
    }
  };

  const getPlanVisualTheme = (plan, idx) => {
    if (plan.isPopular || plan.planId === 'pro') {
      return {
        cardBorder: 'border-2 border-blue-500 ring-4 ring-blue-500/10 shadow-md',
        tagBg: 'bg-blue-600 text-white',
        priceBg: 'bg-blue-50/50 border-blue-100',
        btnBg: 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm',
        icon: Crown,
        iconColor: 'text-blue-600',
        badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
      };
    }
    if (plan.planId === 'enterprise' || idx === 2) {
      return {
        cardBorder: 'border border-slate-200 hover:border-amber-300 hover:shadow-md',
        tagBg: 'bg-amber-100 text-amber-900',
        priceBg: 'bg-amber-50/50 border-amber-100',
        btnBg: 'bg-slate-900 hover:bg-slate-800 text-white shadow-sm',
        icon: Star,
        iconColor: 'text-amber-500',
        badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
      };
    }
    return {
      cardBorder: 'border border-slate-200 hover:border-slate-300 hover:shadow-md',
      tagBg: 'bg-slate-100 text-slate-700',
      priceBg: 'bg-slate-50 border-slate-100',
      btnBg: 'bg-slate-900 hover:bg-slate-800 text-white shadow-sm',
      icon: Zap,
      iconColor: 'text-emerald-600',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
  };

  const displayPlans = plans && plans.length > 0 ? plans : defaultPlanFallbacks;

  return (
    <TrackProLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-16 font-sans">
        
        {/* ========================================================================= */}
        {/* 1. CLEAN MODERN WHITE HEADER (NO BLACK BG)                                */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200">
                  <Zap className="w-3.5 h-3.5 text-amber-600" />
                  SaaS Subscription Engine
                </span>
                <span className="text-xs text-slate-400 font-mono hidden sm:inline-block">
                  Live Quotas & Dynamic Feature Checklists
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                SaaS Pricing & Plan Configuration
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 max-w-2xl leading-relaxed">
                Manage all subscription tiers, seat limits, pricing models, and customizable capability checklists. Changes sync in real-time with Organization checkout.
              </p>
            </div>

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Monthly / Yearly Cycle Switcher */}
              <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    billingCycle === 'monthly'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle('yearly')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                    billingCycle === 'yearly'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Yearly</span>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.2 rounded-md">
                    SAVE 5%
                  </span>
                </button>
              </div>

              {/* Sync All 3 Defaults */}
              <button
                type="button"
                onClick={handleSyncDefaults}
                disabled={syncing}
                className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-2xl border border-slate-200 transition cursor-pointer flex items-center justify-center gap-2 text-xs font-semibold active:scale-95 shadow-2xs"
                title="Sync All 3 Standard SaaS Tiers"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                <span>{syncing ? 'Syncing...' : 'Restore 3 Tiers'}</span>
              </button>

              {/* Create Custom Plan */}
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-sm transition cursor-pointer flex items-center justify-center gap-2 text-xs active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Add Custom Plan</span>
              </button>
            </div>
          </div>
        </div>

        {/* Policy Notice Bar */}
        <div className="bg-amber-50/80 border border-amber-200/80 p-4 rounded-2xl flex items-center gap-3 text-xs font-medium text-amber-900 shadow-2xs">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
          <span>
            Zero-Day Free Trial Policy: All customer organization accounts require an active paid Razorpay subscription to access GPS location telemetry.
          </span>
        </div>

        {/* ========================================================================= */}
        {/* 2. PLANS PRICING CARDS GRID                                               */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {displayPlans.map((plan, idx) => {
            const isPopular = Boolean(plan.isPopular);
            const theme = getPlanVisualTheme(plan, idx);
            const Icon = theme.icon;

            const displayPrice =
              billingCycle === 'yearly'
                ? plan.priceYearly || Math.round(plan.priceMonthly * 12 * 0.95)
                : plan.priceMonthly;

            const monthlyEquivalent =
              billingCycle === 'yearly'
                ? Math.round((plan.priceYearly || plan.priceMonthly * 12 * 0.95) / 12)
                : plan.priceMonthly;

            return (
              <div
                key={plan._id || plan.planId || idx}
                className={`bg-white rounded-3xl p-6 sm:p-7 transition-all duration-200 flex flex-col justify-between relative ${theme.cardBorder}`}
              >
                {/* Popular Pill */}
                {isPopular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider shadow-md flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 fill-white text-white" />
                    <span>{plan.badge || 'MOST POPULAR'}</span>
                  </div>
                )}

                <div>
                  {/* Top Header Tag */}
                  <div className="flex items-center justify-between gap-2 pb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold bg-slate-100 ${theme.iconColor}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        {plan.planId?.toUpperCase()} TIER
                      </span>
                    </div>

                    {!isPopular && plan.badge && (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${theme.badgeColor}`}>
                        {plan.badge}
                      </span>
                    )}
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
                    {plan.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 min-h-[32px] line-clamp-2 leading-relaxed">
                    {plan.description || 'Tiered field telemetry tracking subscription.'}
                  </p>

                  {/* Price Block */}
                  <div className={`my-5 p-4 rounded-2xl border ${theme.priceBg}`}>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight font-mono">
                        ₹{displayPrice?.toLocaleString('en-IN')}
                      </span>
                      <span className="text-xs font-medium text-slate-500">
                        /{billingCycle === 'yearly' ? 'year' : 'month'}
                      </span>
                    </div>

                    {billingCycle === 'yearly' ? (
                      <div className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
                        <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Includes 5% Annual Discount (~₹{monthlyEquivalent}/mo)</span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400 font-medium block mt-1">
                        Billed monthly per organization
                      </span>
                    )}
                  </div>

                  {/* Quota Limits Bar */}
                  <div className="grid grid-cols-2 gap-2 my-4">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                      <span className="text-[10px] font-semibold uppercase text-slate-400 block">Employees</span>
                      <span className="text-sm font-bold text-slate-900">{plan.maxEmployees} Seats</span>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                      <span className="text-[10px] font-semibold uppercase text-slate-400 block">Managers</span>
                      <span className="text-sm font-bold text-slate-900">{plan.maxManagers} Seats</span>
                    </div>
                  </div>

                  {/* Feature Checklist */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      INCLUDED CAPABILITIES ({plan.features?.length || 0}):
                    </span>
                    <ul className="space-y-2 text-xs">
                      {Array.isArray(plan.features) &&
                        plan.features.map((feature, i) => {
                          let displayFeature = feature;
                          if (/^Up to \d+ (Field )?Employee/i.test(feature) || /^\d+ Employee Accounts/i.test(feature)) {
                            displayFeature = `Up to ${plan.maxEmployees} Employee Accounts`;
                          } else if (/^\d+ Manager Accounts/i.test(feature) || /^Up to \d+ Manager/i.test(feature)) {
                            displayFeature = `${plan.maxManagers} Manager Accounts`;
                          }
                          return (
                            <li key={i} className="flex items-start gap-2 text-slate-700 font-medium leading-tight">
                              <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                              <span>{displayFeature}</span>
                            </li>
                          );
                        })}
                    </ul>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="pt-6 mt-6 border-t border-slate-100 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(plan)}
                    className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer ${theme.btnBg}`}
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>Edit Plan & Features</span>
                  </button>

                  {displayPlans.length > 3 && (
                    <button
                      type="button"
                      onClick={() => handleDeletePlan(plan)}
                      className="p-3 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 rounded-xl transition cursor-pointer"
                      title="Delete Custom Plan"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ========================================================================= */}
        {/* 3. EDIT PLAN MODAL (FULL CAPABILITY EDITOR)                                */}
        {/* ========================================================================= */}
        {showEditModal && selectedPlan && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 border border-slate-200 shadow-2xl relative space-y-6 my-8 max-h-[90vh] overflow-y-auto">
              
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    <Sliders className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                      Edit {selectedPlan.name}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Configure plan pricing rates, seat limits, and full feature checklist
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSavePlan} className="space-y-4">
                
                {/* Row 1: Plan Display Name & Badge */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700">Plan Display Name *</label>
                    <input
                      type="text"
                      required
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-slate-900"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700">Badge / Tagline</label>
                    <input
                      type="text"
                      placeholder="e.g. Starter Tier, Most Popular"
                      value={editForm.badge}
                      onChange={(e) => setEditForm({ ...editForm, badge: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-slate-900"
                    />
                  </div>
                </div>

                {/* Subtitle / Description */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">Plan Subtitle / Description</label>
                  <input
                    type="text"
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium text-slate-800"
                  />
                </div>

                {/* Row 2: Monthly Price, Yearly Price, Max Employees, Max Managers */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700">Monthly Price (₹) *</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={editForm.priceMonthly}
                      onChange={(e) => {
                        const monthly = Number(e.target.value);
                        setEditForm({
                          ...editForm,
                          priceMonthly: monthly,
                          priceYearly: Math.round(monthly * 12 * 0.95),
                        });
                      }}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono font-bold text-slate-900"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700">Yearly Price (₹) *</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={editForm.priceYearly}
                      onChange={(e) => setEditForm({ ...editForm, priceYearly: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono font-bold text-emerald-700"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700">Max Employees *</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={editForm.maxEmployees}
                      onChange={(e) => setEditForm({ ...editForm, maxEmployees: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-slate-900"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700">Max Managers *</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={editForm.maxManagers}
                      onChange={(e) => setEditForm({ ...editForm, maxManagers: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-slate-900"
                    />
                  </div>
                </div>

                {/* Popular Highlight Checkbox */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.isPopular}
                      onChange={(e) => setEditForm({ ...editForm, isPopular: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                    />
                    <span>Highlight as "Most Popular / Recommended" Plan Card</span>
                  </label>
                </div>

                {/* Feature Checklist Manager */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Feature Checklist ({editForm.features.length} Items):
                    </label>
                    <span className="text-[10px] text-slate-400">Click 🗑️ to delete</span>
                  </div>

                  {/* Feature items */}
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {editForm.features.map((feat, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between bg-white border border-slate-200 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-800 shadow-2xs hover:border-slate-300 transition"
                      >
                        <span className="truncate pr-2">{feat}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveFeatureFromEdit(index)}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add New Feature Input */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Type a new feature capability..."
                      value={newFeatureText}
                      onChange={(e) => setNewFeatureText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddFeatureToEdit();
                        }
                      }}
                      className="flex-1 px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                    />
                    <button
                      type="button"
                      onClick={handleAddFeatureToEdit}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  </div>

                  {/* Quick Feature Suggestions */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Quick Suggestions (Click to add):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestedFeatures.map((feat, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleAddSuggestedFeature(feat)}
                          className="text-[11px] px-2.5 py-1 rounded-lg bg-blue-50/70 hover:bg-blue-100 text-blue-700 border border-blue-200 transition cursor-pointer"
                        >
                          + {feat}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Modal Footer Actions */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider transition cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Plan Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 4. CREATE NEW CUSTOM PLAN MODAL                                           */}
        {/* ========================================================================= */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 border border-slate-200 shadow-2xl relative space-y-6 my-8 max-h-[90vh] overflow-y-auto">
              
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                      Add New SaaS Plan Tier
                    </h3>
                    <p className="text-xs text-slate-500">
                      Create a custom subscription tier with customized quota limits and pricing
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreatePlan} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700">Plan Display Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Enterprise Plus"
                      value={createForm.name}
                      onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700">Badge / Tagline</label>
                    <input
                      type="text"
                      placeholder="e.g. Best Value, High Volume"
                      value={createForm.badge}
                      onChange={(e) => setCreateForm({ ...createForm, badge: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">Plan Description</label>
                  <input
                    type="text"
                    placeholder="Brief description for customer admins during checkout"
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700">Monthly Price (₹) *</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={createForm.priceMonthly}
                      onChange={(e) => {
                        const monthly = Number(e.target.value);
                        setCreateForm({
                          ...createForm,
                          priceMonthly: monthly,
                          priceYearly: Math.round(monthly * 12 * 0.95),
                        });
                      }}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700">Yearly Price (₹) *</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={createForm.priceYearly}
                      onChange={(e) => setCreateForm({ ...createForm, priceYearly: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-emerald-700"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700">Max Employees *</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={createForm.maxEmployees}
                      onChange={(e) => setCreateForm({ ...createForm, maxEmployees: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700">Max Managers *</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={createForm.maxManagers}
                      onChange={(e) => setCreateForm({ ...createForm, maxManagers: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl font-bold"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider shadow-sm"
                  >
                    {creating ? 'Creating Plan...' : 'Create Plan Tier'}
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
