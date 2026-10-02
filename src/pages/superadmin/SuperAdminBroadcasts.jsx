import React, { useState, useEffect } from 'react';
import KisanConnectLayout from '../../components/layout/KisanConnectLayout';
import {
  Radio,
  Send,
  RefreshCw,
  Search,
  Trash2,
  Copy,
  AlertTriangle,
  CheckCircle2,
  Users,
  Building2,
  Bell,
  Clock,
  Zap,
  ShieldAlert,
  Layers,
  Check,
  RotateCcw,
  Smartphone,
  Eye,
  Megaphone,
  Filter,
  ArrowRight,
  Wifi,
  Battery,
  Signal,
  CheckCheck,
  Info,
  Globe,
  MessageSquare,
  FileText,
  Bookmark,
  SlidersHorizontal,
  ChevronRight,
  Server,
} from 'lucide-react';
import { API } from '../../services/api.service';
import toast from 'react-hot-toast';

export default function SuperAdminBroadcasts() {
  const [broadcasts, setBroadcasts] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');

  const [formData, setFormData] = useState({
    title: '',
    message: '',
    priority: 'urgent',
    category: 'general',
    targetRole: 'ALL',
    organizationId: 'ALL',
  });

  // Professional Preset Templates (Clean Corporate Icons)
  const presetTemplates = [
    {
      label: 'Safety Advisory',
      icon: ShieldAlert,
      title: 'Emergency Weather & Field Safety Advisory',
      message: 'Severe weather advisory issued for active operational zones. All field executives are advised to prioritize safety and follow standard protocol.',
      priority: 'urgent',
      category: 'alert',
      targetRole: 'EMPLOYEE',
    },
    {
      label: 'System Maintenance',
      icon: Server,
      title: 'Scheduled System Maintenance Notice',
      message: 'KisanConnect infrastructure will undergo scheduled database maintenance on Sunday at 2:00 AM IST (approx. 30 mins). Field tracking data syncs automatically.',
      priority: 'high',
      category: 'maintenance',
      targetRole: 'ALL',
    },
    {
      label: 'Shift Punch-In',
      icon: Clock,
      title: 'Daily Attendance & GPS Location Verification',
      message: 'Please ensure morning attendance is marked and maintain active GPS location permissions during your field service hours.',
      priority: 'normal',
      category: 'reminder',
      targetRole: 'EMPLOYEE',
    },
    {
      label: 'Release Notes v2.4',
      icon: Layers,
      title: 'KisanConnect Update v2.4 Released',
      message: 'A new platform update is live featuring optimized battery usage, instant route telemetry, and enhanced visit logging. Please refresh your application.',
      priority: 'info',
      category: 'feature',
      targetRole: 'ALL',
    },
    {
      label: 'Billing Renewal',
      icon: Building2,
      title: 'Subscription Tier Renewal Advisory',
      message: 'Attention Organization Admins: Your subscription plan is approaching its renewal window. Please review your billing console to prevent service disruption.',
      priority: 'high',
      category: 'reminder',
      targetRole: 'ORG_ADMIN',
    },
  ];

  const fetchBroadcasts = async () => {
    try {
      setLoading(true);
      const res = await API.get('/superadmin/broadcasts');
      if (res.data?.success) {
        setBroadcasts(res.data.broadcasts || []);
      }
    } catch (error) {
      toast.error('Failed to load broadcasts feed');
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
      console.warn('Failed to load orgs');
    }
  };

  useEffect(() => {
    fetchBroadcasts();
    fetchOrganizations();
  }, []);

  const handleApplyTemplate = (tpl) => {
    setFormData((prev) => ({
      ...prev,
      title: tpl.title,
      message: tpl.message,
      priority: tpl.priority,
      category: tpl.category,
      targetRole: tpl.targetRole,
    }));
    toast.success(`Template loaded: ${tpl.label}`);
  };

  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error('Please enter an announcement title');
      return;
    }
    if (!formData.message.trim()) {
      toast.error('Please enter the announcement message');
      return;
    }

    try {
      setSending(true);
      const res = await API.post('/superadmin/broadcasts', formData);
      if (res.data?.success) {
        toast.success(`Broadcast dispatched to ${res.data.recipientCount} accounts in real-time.`);
        setFormData({
          title: '',
          message: '',
          priority: 'urgent',
          category: 'general',
          targetRole: 'ALL',
          organizationId: 'ALL',
        });
        fetchBroadcasts();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to dispatch broadcast');
    } finally {
      setSending(false);
    }
  };

  const handleDeleteBroadcast = async (id, title) => {
    if (!window.confirm(`Delete broadcast "${title}"?`)) return;
    try {
      const res = await API.delete(`/superadmin/broadcasts/${id}`);
      if (res.data?.success) {
        toast.success('Broadcast removed from log');
        fetchBroadcasts();
      }
    } catch (error) {
      toast.error('Failed to delete broadcast');
    }
  };

  const handleResendBroadcast = async (b) => {
    try {
      const payload = {
        title: b.title,
        message: b.message,
        priority: b.priority,
        category: b.category,
        targetRole: b.targetRole,
        organizationId: b.targetOrganization || 'ALL',
      };
      const res = await API.post('/superadmin/broadcasts', payload);
      if (res.data?.success) {
        toast.success(`Re-dispatched to ${res.data.recipientCount} accounts.`);
        fetchBroadcasts();
      }
    } catch (error) {
      toast.error('Failed to re-send broadcast');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied announcement text to clipboard.');
  };

  const filteredBroadcasts = broadcasts.filter((b) => {
    const matchesSearch =
      b.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.message?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPriority = priorityFilter === 'all' || b.priority === priorityFilter;
    return matchesSearch && matchesPriority;
  });

  const totalReachCount = broadcasts.reduce((acc, curr) => acc + (curr.recipientCount || 0), 0);

  const getPriorityTheme = (priority) => {
    switch (priority) {
      case 'urgent':
        return {
          pill: 'bg-rose-50 text-rose-700 border-rose-200',
          btnActive: 'bg-rose-600 text-white border-rose-600 shadow-sm',
          label: 'Urgent Alert',
          previewBorder: 'border-rose-300 bg-rose-50/50',
          previewHeader: 'bg-rose-600 text-white',
          accent: 'text-rose-700',
        };
      case 'high':
        return {
          pill: 'bg-amber-50 text-amber-800 border-amber-200',
          btnActive: 'bg-amber-600 text-white border-amber-600 shadow-sm',
          label: 'High Priority',
          previewBorder: 'border-amber-300 bg-amber-50/50',
          previewHeader: 'bg-amber-600 text-white',
          accent: 'text-amber-700',
        };
      case 'normal':
        return {
          pill: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          btnActive: 'bg-indigo-600 text-white border-indigo-600 shadow-sm',
          label: 'General Notice',
          previewBorder: 'border-indigo-300 bg-indigo-50/50',
          previewHeader: 'bg-indigo-600 text-white',
          accent: 'text-indigo-700',
        };
      case 'info':
      default:
        return {
          pill: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          btnActive: 'bg-emerald-600 text-white border-emerald-600 shadow-sm',
          label: 'Informational',
          previewBorder: 'border-emerald-300 bg-emerald-50/50',
          previewHeader: 'bg-emerald-600 text-white',
          accent: 'text-emerald-700',
        };
    }
  };

  const priorityCfg = getPriorityTheme(formData.priority);

  return (
    <KisanConnectLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-16">
        
        {/* ========================================================================= */}
        {/* 1. PROFESSIONAL COMMAND HEADER                                            */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
                  <Radio className="w-3.5 h-3.5 text-rose-600 animate-pulse" />
                  Live Broadcast Engine
                </span>
                <span className="text-xs text-slate-400 font-mono hidden sm:inline-block">
                  WebSocket Real-Time Gateway
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Platform Broadcasts & Announcements
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 max-w-2xl leading-relaxed">
                Dispatch verified announcements, compliance notices, and critical alerts directly to active field personnel and customer organization consoles.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={fetchBroadcasts}
                className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-2xl border border-slate-200 transition cursor-pointer flex items-center gap-2 text-xs font-semibold active:scale-95 shadow-2xs"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Sync Log</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-6 border-t border-slate-100">
            <div className="flex items-center gap-3 bg-slate-50/80 border border-slate-100 p-3.5 rounded-2xl">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                <Megaphone className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Dispatched</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-xl font-bold text-slate-900">{broadcasts.length}</h3>
                  <span className="text-[10px] text-rose-600 font-semibold">Logged</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-slate-50/80 border border-slate-100 p-3.5 rounded-2xl">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Reach</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-xl font-bold text-slate-900">{totalReachCount}</h3>
                  <span className="text-[10px] text-indigo-600 font-semibold">Active Devices</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-slate-50/80 border border-slate-100 p-3.5 rounded-2xl">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Socket Connection</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-xl font-bold text-emerald-600">Online</h3>
                  <span className="text-[10px] text-emerald-600 font-semibold">Zero Latency</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. COMPOSER & HISTORY SPLIT                                               */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT: COMPOSER (5 COLS) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Form Card */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-5">
              
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-sm">
                    <Send className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-900 tracking-tight">Compose Announcement</h2>
                    <p className="text-[11px] text-slate-500 font-medium">Real-time alert dispatch to targeted users</p>
                  </div>
                </div>

                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold">
                  v2.4 Push
                </span>
              </div>

              {/* Preset Templates */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Bookmark className="w-3.5 h-3.5 text-slate-600" />
                    Standard Templates
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal lowercase">click to apply</span>
                </label>

                <div className="flex flex-wrap gap-1.5">
                  {presetTemplates.map((tpl, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleApplyTemplate(tpl)}
                      className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition active:scale-95 cursor-pointer shadow-2xs"
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Form Fields */}
              <form onSubmit={handleSendBroadcast} className="space-y-4">
                
                {/* Title */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Announcement Headline <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Critical Safety Advisory & Route Notice"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 font-bold text-slate-900 transition placeholder:text-slate-400"
                  />
                </div>

                {/* Priority Selector */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Priority Level <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'urgent', label: 'Urgent' },
                      { id: 'high', label: 'High' },
                      { id: 'normal', label: 'Normal' },
                      { id: 'info', label: 'Info' },
                    ].map((p) => {
                      const isSelected = formData.priority === p.id;
                      const theme = getPriorityTheme(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setFormData({ ...formData, priority: p.id })}
                          className={`py-2 px-2 rounded-xl text-xs font-bold transition text-center cursor-pointer border ${
                            isSelected
                              ? theme.btnActive
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Target Audience & Target Organization */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">Target Role</label>
                    <select
                      value={formData.targetRole}
                      onChange={(e) => setFormData({ ...formData, targetRole: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 font-bold text-slate-800 transition"
                    >
                      <option value="ALL">All Roles (Global)</option>
                      <option value="EMPLOYEE">Field Employees Only</option>
                      <option value="MANAGER">Field Managers Only</option>
                      <option value="ORG_ADMIN">Organization Admins Only</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">Target Organization</label>
                    <select
                      value={formData.organizationId}
                      onChange={(e) => setFormData({ ...formData, organizationId: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 font-bold text-slate-800 truncate transition"
                    >
                      <option value="ALL">All Organizations</option>
                      {organizations.map((org) => (
                        <option key={org._id} value={org._id}>
                          {org.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Message Body */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700">
                      Announcement Message <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {formData.message.length} chars
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    required
                    placeholder="Enter the complete announcement body. This message is delivered immediately to active recipient screens..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 text-slate-900 font-medium text-xs leading-relaxed transition placeholder:text-slate-400"
                  />
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={sending}
                  className="w-full py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider shadow-md transition active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>{sending ? 'Dispatching...' : 'Dispatch Live Broadcast'}</span>
                </button>
              </form>
            </div>

            {/* In-App Live Popover Preview */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-slate-600" />
                  <span className="text-xs font-bold text-slate-900">In-App Notification Preview</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">Recipient Modal View</span>
              </div>

              {/* Clean Preview Dialog */}
              <div className={`p-4 rounded-2xl border transition-all ${priorityCfg.previewBorder}`}>
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md border ${priorityCfg.pill}`}>
                    {priorityCfg.label}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">Just Now</span>
                </div>

                <div className="mt-2.5 space-y-1.5">
                  <h4 className="text-sm font-black text-slate-900 tracking-tight leading-snug">
                    {formData.title || 'Announcement Headline Appears Here'}
                  </h4>
                  <p className="text-xs text-slate-700 bg-white p-3 rounded-xl border border-slate-200/60 font-medium leading-relaxed">
                    {formData.message || 'The detailed broadcast announcement body will appear directly on recipient screens in real time.'}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 mt-2 text-[10px] text-slate-500 border-t border-slate-200/60">
                  <span>Target: <strong className="text-slate-900">{formData.targetRole}</strong></span>
                  <span className="px-3 py-1 rounded-lg bg-slate-900 text-white font-bold">
                    Acknowledge
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT: BROADCAST LOG (7 COLS) */}
          <div className="lg:col-span-7 space-y-4">
            
            {/* Filter Toolbar */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search broadcasts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 font-semibold"
                />
              </div>

              {/* Priority Filter Pills */}
              <div className="flex items-center gap-1 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                {['all', 'urgent', 'high', 'normal', 'info'].map((p) => {
                  const isSelected = priorityFilter === p;
                  return (
                    <button
                      key={p}
                      onClick={() => setPriorityFilter(p)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer shrink-0 ${
                        isSelected
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Broadcasts List */}
            <div className="space-y-3">
              {filteredBroadcasts.length === 0 ? (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-12 text-center space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center mx-auto border border-slate-100">
                    <Bell className="w-7 h-7" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">No Broadcasts Logged</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                    Compose an announcement on the left panel to dispatch a real-time broadcast.
                  </p>
                </div>
              ) : (
                filteredBroadcasts.map((b) => {
                  const cfg = getPriorityTheme(b.priority);
                  return (
                    <div
                      key={b._id}
                      className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 hover:shadow-md transition-all duration-200 p-5 space-y-3.5 group"
                    >
                      {/* Card Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${cfg.pill}`}>
                            {b.priority || 'NORMAL'}
                          </span>
                          <h4 className="text-sm font-black text-slate-900 tracking-tight">
                            {b.title}
                          </h4>
                        </div>

                        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {new Date(b.createdAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}{' '}
                            •{' '}
                            {new Date(b.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>

                      {/* Message Content */}
                      <p className="text-xs text-slate-700 font-medium leading-relaxed bg-slate-50/80 p-3.5 rounded-xl border border-slate-100 whitespace-pre-line">
                        {b.message}
                      </p>

                      {/* Bottom Meta & Actions */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 text-xs">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-500">
                          <span className="flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-lg">
                            <Users className="w-3.5 h-3.5 text-blue-600" />
                            <span>Target: <strong>{b.targetRole || 'ALL'}</strong></span>
                          </span>

                          <span className="flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-lg">
                            <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                            <span>{b.organizationName || 'Global (All Orgs)'}</span>
                          </span>

                          <span className="text-emerald-700 font-bold flex items-center gap-1 ml-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            {b.recipientCount || 0} Delivered
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition">
                          <button
                            type="button"
                            onClick={() => copyToClipboard(b.message)}
                            className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                            title="Copy Announcement Text"
                          >
                            <Copy className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleResendBroadcast(b)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition cursor-pointer"
                            title="Re-send Announcement"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Re-send</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteBroadcast(b._id, b.title)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                            title="Delete Broadcast"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>

        </div>

      </div>
    </KisanConnectLayout>
  );
}
