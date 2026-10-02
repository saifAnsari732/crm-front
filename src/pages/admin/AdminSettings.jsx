import React, { useState, useEffect, useRef } from 'react';
import KisanConnectLayout from '../../components/layout/KisanConnectLayout';
import { adminAPI, uploadAPI } from '../../services/api.service';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import {
  Building2,
  MapPin,
  Clock,
  ShieldCheck,
  Receipt,
  Briefcase,
  Save,
  RefreshCw,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Navigation,
  FileCheck,
  Lock,
  Sparkles,
  Upload,
  Camera,
  Image as ImageIcon,
  Trash2,
  Mail,
  Phone,
  Compass,
  Fuel,
  Check,
  Layers,
  Globe,
  Radio,
  Copy,
  Info,
  Car,
  Bike,
  LogOut,
  Shield,
  Zap,
  SlidersHorizontal,
  CheckSquare
} from 'lucide-react';

export default function AdminSettings() {
  const { user, organization: authOrg, updateOrganization, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [locatingOffice, setLocatingOffice] = useState(false);
  const logoInputRef = useRef(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    slug: '',
    logo: '',
    address: {
      street: '',
      city: '',
      state: '',
      pincode: '',
      country: 'India',
    },
    settings: {
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      minDistanceMeters: 10,
      maxAccuracyMeters: 200,
      trackingIntervalSeconds: 30,
      officeLat: 26.8467,
      officeLng: 80.9462,
      geofenceRadiusMeters: 150,
      strictGeofence: true,
      requireSelfieAttendance: true,
      shiftStartTime: '09:30',
      shiftEndTime: '18:30',
      gracePeriodMinutes: 15,
      autoApproveLimit: 300,
      receiptMandatoryAbove: 100,
      fuelPerKmRateBike: 3.5,
      fuelPerKmRateCar: 8.0,
      allowCategories: ['fuel', 'food', 'hotel', 'travel', 'misc'],
      requireClientSignature: true,
      requireMeetingSelfie: true,
      minMeetingDurationMinutes: 10,
    },
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data } = await adminAPI.getOrganization();
      if (data.organization) {
        const org = data.organization;
        setFormData({
          name: org.name || '',
          email: org.email || '',
          phone: org.phone || '',
          slug: org.slug || '',
          logo: org.logo || '/images/icon.jpg',
          address: {
            street: org.address?.street || '',
            city: org.address?.city || '',
            state: org.address?.state || '',
            pincode: org.address?.pincode || '',
            country: org.address?.country || 'India',
          },
          settings: {
            currency: org.settings?.currency || 'INR',
            timezone: org.settings?.timezone || 'Asia/Kolkata',
            minDistanceMeters: org.settings?.minDistanceMeters ?? 10,
            maxAccuracyMeters: org.settings?.maxAccuracyMeters ?? 200,
            trackingIntervalSeconds: org.settings?.trackingIntervalSeconds ?? 30,
            officeLat: org.settings?.officeLat ?? 26.8467,
            officeLng: org.settings?.officeLng ?? 80.9462,
            geofenceRadiusMeters: org.settings?.geofenceRadiusMeters ?? 150,
            strictGeofence: org.settings?.strictGeofence ?? true,
            requireSelfieAttendance: org.settings?.requireSelfieAttendance ?? true,
            shiftStartTime: org.settings?.shiftStartTime || '09:30',
            shiftEndTime: org.settings?.shiftEndTime || '18:30',
            gracePeriodMinutes: org.settings?.gracePeriodMinutes ?? 15,
            autoApproveLimit: org.settings?.autoApproveLimit ?? 300,
            receiptMandatoryAbove: org.settings?.receiptMandatoryAbove ?? 100,
            fuelPerKmRateBike: org.settings?.fuelPerKmRateBike ?? 3.5,
            fuelPerKmRateCar: org.settings?.fuelPerKmRateCar ?? 8.0,
            allowCategories: org.settings?.allowCategories || ['fuel', 'food', 'hotel', 'travel', 'misc'],
            requireClientSignature: org.settings?.requireClientSignature ?? true,
            requireMeetingSelfie: org.settings?.requireMeetingSelfie ?? true,
            minMeetingDurationMinutes: org.settings?.minMeetingDurationMinutes ?? 10,
          },
        });
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load organization settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    setSaving(true);
    try {
      const { data } = await adminAPI.updateOrganization(formData);
      if (data.organization && updateOrganization) {
        updateOrganization(data.organization);
      }
      toast.success('🎉 Organization settings & logo saved successfully!');
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveLogo = async () => {
    setFormData((prev) => ({ ...prev, logo: '' }));
    try {
      const saveRes = await adminAPI.updateOrganization({ logo: '' });
      if (saveRes.data?.organization && updateOrganization) {
        updateOrganization(saveRes.data.organization);
      } else if (updateOrganization) {
        updateOrganization({ logo: '' });
      }
      toast.success('Logo reset to default');
    } catch (err) {
      console.error('Reset logo error:', err);
      toast.error('Failed to reset logo');
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (PNG, JPG, JPEG, WEBP)');
      return;
    }

    let localPreview = '';
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        localPreview = event.target.result;
        setFormData((prev) => ({ ...prev, logo: localPreview }));
        if (updateOrganization) {
          updateOrganization({ logo: localPreview });
        }
      }
    };
    reader.readAsDataURL(file);

    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const { data } = await uploadAPI.uploadImage(fd);
      const logoUrl = data && data.url ? data.url : localPreview;

      if (logoUrl) {
        setFormData((prev) => ({ ...prev, logo: logoUrl }));
        const saveRes = await adminAPI.updateOrganization({ logo: logoUrl });
        if (saveRes.data?.organization && updateOrganization) {
          updateOrganization(saveRes.data.organization);
        } else if (updateOrganization) {
          updateOrganization({ logo: logoUrl });
        }
        toast.success('Organization logo uploaded & saved permanently!');
      }
    } catch (err) {
      console.error('Logo upload server error:', err);
      if (localPreview) {
        try {
          const saveRes = await adminAPI.updateOrganization({ logo: localPreview });
          if (saveRes.data?.organization && updateOrganization) {
            updateOrganization(saveRes.data.organization);
          }
          toast.success('Organization logo saved to database!');
        } catch (dbErr) {
          toast.error('Failed to save logo to database');
        }
      } else {
        toast.error('Failed to upload logo image');
      }
    } finally {
      setUploadingLogo(false);
    }
  };

  const updateSetting = (key, value) => {
    setFormData((prev) => ({
      ...prev,
      settings: { ...prev.settings, [key]: value },
    }));
  };

  const updateAddress = (key, value) => {
    setFormData((prev) => ({
      ...prev,
      address: { ...prev.address, [key]: value },
    }));
  };

  const handleDetectCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    setLocatingOffice(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        updateSetting('officeLat', parseFloat(pos.coords.latitude.toFixed(6)));
        updateSetting('officeLng', parseFloat(pos.coords.longitude.toFixed(6)));
        toast.success(`📍 Office coordinates set: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
        setLocatingOffice(false);
      },
      (err) => {
        toast.error('Could not detect location: ' + err.message);
        setLocatingOffice(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <KisanConnectLayout>
      <div className="space-y-6 max-w-[1600px] mx-auto pb-16 font-sans">

        {/* ── Top Header Bar (Clean Slate & Blue Palette - No Black Colors) ── */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center font-black shadow-xs shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Organization Control Center</h1>
                <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Verified SaaS Account
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Manage organization logo, company identity, GPS intervals, shift policies, and features list.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={fetchSettings}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Reset</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black shadow-md shadow-blue-500/25 transition active:scale-98 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving Settings...' : 'Save Organization Logo & Settings'}</span>
            </button>
          </div>
        </div>

        {/* ── Category Navigation Tabs ── */}
        <div className="bg-white p-2 rounded-2xl border border-slate-200/90 shadow-xs flex items-center gap-1.5 overflow-x-auto hide-scrollbar">
          {[
            { id: 'general', label: 'Company & Branding', icon: Building2 },
            { id: 'features', label: 'Org Feature Matrix', icon: Sparkles },
            { id: 'geofence', label: 'Geofence & Shifts', icon: MapPin },
            { id: 'tracking', label: 'GPS Engine', icon: Navigation },
            { id: 'expenses', label: 'Expenses & TA/DA', icon: Receipt },
            { id: 'meetings', label: 'Visits & Client Rules', icon: Briefcase },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'text-slate-600 hover:text-blue-600 hover:bg-blue-50/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="p-16 text-center bg-white rounded-3xl border border-slate-200 shadow-xs flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
            <p className="text-slate-700 font-bold text-sm">Loading organization policies...</p>
          </div>
        ) : (
          <div className="space-y-6">

            {/* ========================================================================= */}
            {/* TAB 1: COMPANY BRANDING & GENERAL PROFILE */}
            {/* ========================================================================= */}
            {activeTab === 'general' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Main Branding & Address Card (8 Cols) */}
                <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-xs space-y-6">

                  {/* Logo Brand Upload Box */}
                  <div className="p-5 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50/70 via-slate-50/40 to-white flex flex-col sm:flex-row items-center justify-between gap-5">
                    <div className="flex items-center gap-4">
                      <div className="relative group">
                        <div className="w-20 h-20 rounded-2xl border-2 border-blue-200 bg-white shadow-sm overflow-hidden flex items-center justify-center p-1.5">
                          <img
                            src={formData.logo || '/images/icon.jpg'}
                            alt="Organization Logo"
                            className="w-full h-full object-contain rounded-xl"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = '/images/icon.jpg';
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => logoInputRef.current?.click()}
                          className="absolute -bottom-1 -right-1 p-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition shadow-md cursor-pointer"
                          title="Upload Brand Logo"
                        >
                          <Camera className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div>
                        <h3 className="text-sm font-black text-slate-900">Organization Logo & Branding</h3>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                          Upload PNG, JPG or WEBP logo for mobile portals and reports.
                        </p>
                        <span className="inline-block mt-1.5 text-[10px] font-extrabold text-blue-700 bg-blue-100/80 px-2.5 py-0.5 rounded-md">
                          Recommended: Square Aspect Ratio (250×250 PNG)
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        ref={logoInputRef}
                        onChange={handleLogoUpload}
                        accept="image/*"
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => logoInputRef.current?.click()}
                        disabled={uploadingLogo}
                        className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {uploadingLogo ? (
                          <RefreshCw className="w-4 h-4 animate-spin text-white" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                        <span>{uploadingLogo ? 'Uploading...' : 'Upload New Logo'}</span>
                      </button>

                      {formData.logo && (
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          className="p-2.5 rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          title="Reset logo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Logo Direct Link & Basic Info */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
                      Organization Profile Fields
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          Logo Image URL (Direct Link)
                        </label>
                        <div className="relative">
                          <ImageIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                          <input
                            type="text"
                            value={formData.logo}
                            onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
                            placeholder="https://ik.imagekit.io/..."
                            className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-semibold text-slate-900 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Organization Name</label>
                        <div className="relative">
                          <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                          <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Primary Support Email</label>
                        <div className="relative">
                          <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                          <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Contact Phone Number</label>
                        <div className="relative">
                          <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                          <input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Organization Tenant Slug</label>
                        <div className="relative">
                          <Globe className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                          <input
                            type="text"
                            disabled
                            value={formData.slug || 'kisan-choice'}
                            className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-500 font-mono font-semibold"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Registered Headquarters Address */}
                  <div className="space-y-4 pt-3 border-t border-slate-100">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                      Registered Headquarters Address
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Street Address</label>
                        <input
                          type="text"
                          value={formData.address.street}
                          onChange={(e) => updateAddress('street', e.target.value)}
                          placeholder="e.g. Plot 42, Kisan Bhavan Road"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">City</label>
                        <input
                          type="text"
                          value={formData.address.city}
                          onChange={(e) => updateAddress('city', e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">State</label>
                        <input
                          type="text"
                          value={formData.address.state}
                          onChange={(e) => updateAddress('state', e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Pincode</label>
                        <input
                          type="text"
                          value={formData.address.pincode}
                          onChange={(e) => updateAddress('pincode', e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Country</label>
                        <input
                          type="text"
                          value={formData.address.country}
                          onChange={(e) => updateAddress('country', e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column Plan & License Card (4 Cols) */}
                <div className="lg:col-span-4 space-y-5">
                  <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white rounded-3xl p-6 shadow-xl space-y-5">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center font-bold">
                        <ShieldCheck className="w-5 h-5 text-white" />
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-400/25 text-emerald-300 border border-emerald-400/40 uppercase tracking-wider">
                        {authOrg?.status === 'active' ? 'ACTIVE SUBSCRIPTION' : 'ENTERPRISE PRO'}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-lg font-black tracking-tight">
                        {authOrg?.plan?.planName || authOrg?.name || 'Kisan Choice'} License
                      </h3>
                      <p className="text-xs text-blue-100 mt-1">
                        Full multi-tenant field monitoring with real-time GPS telemetry, visit logs, and expense audits.
                      </p>
                    </div>

                    <div className="space-y-2.5 border-t border-white/15 pt-4 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-blue-100">Field Employee Seats:</span>
                        <span className="font-bold">{authOrg?.plan?.maxEmployees || 50} Max Seats</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-blue-100">Manager Quota:</span>
                        <span className="font-bold">{authOrg?.plan?.maxManagers || 5} Managers</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-blue-100">GPS Ping Interval:</span>
                        <span className="font-bold text-emerald-300">{formData.settings.trackingIntervalSeconds}s Real-Time</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-blue-100">Cloud Storage:</span>
                        <span className="font-bold">ImageKit CDN</span>
                      </div>
                    </div>
                  </div>

                  {/* Account Logout Card (Light Styled - No Black) */}
                  <div className="bg-rose-50/70 rounded-3xl border border-rose-200 p-5 shadow-xs space-y-3">
                    <div className="flex items-center gap-2 text-rose-900 font-black text-xs uppercase tracking-wider">
                      <LogOut className="w-4 h-4 text-rose-600" /> Account Controls
                    </div>
                    <p className="text-xs text-rose-700/80 font-medium">
                      Signing out will terminate your current session on this device.
                    </p>
                    <button
                      type="button"
                      onClick={logout}
                      className="w-full py-2.5 px-4 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-700 font-extrabold text-xs transition border border-rose-300 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Logout from KisanConnect Account</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 2: ORGANIZATION FEATURE MATRIX */}
            {/* ========================================================================= */}
            {activeTab === 'features' && (
              <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-xs space-y-6">
                <div className="border-b border-slate-100 pb-3">
                  <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-blue-600" />
                    Organization Enabled Features & Service Capabilities
                  </h2>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Complete list of active modules and features configured for your organization profile.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {[
                    {
                      title: 'Live GPS Telemetry & Map Replay',
                      desc: 'Real-time background location updates every 15-30s with polyline route playback.',
                      icon: Navigation,
                      color: 'blue',
                    },
                    {
                      title: 'Geofenced Attendance & Selfie',
                      desc: 'Restrict check-ins within HQ GPS perimeter with compulsory live front camera photos.',
                      icon: MapPin,
                      color: 'emerald',
                    },
                    {
                      title: 'Automated TA & DA Travel Calculator',
                      desc: 'Automatic distance calculation in KM multiplied by configured vehicle rates.',
                      icon: Fuel,
                      color: 'purple',
                    },
                    {
                      title: 'Client Visits & Touch Signatures',
                      desc: 'Field store check-ins with client touch-screen signature and meeting notes.',
                      icon: Briefcase,
                      color: 'indigo',
                    },
                    {
                      title: 'Expense Claims & Receipt Auditing',
                      desc: 'Category-wise expense requests with receipt photo upload and instant approval.',
                      icon: Receipt,
                      color: 'amber',
                    },
                    {
                      title: 'Task Orders & Leads Pipeline',
                      desc: 'Assign field work orders, due dates, priority levels, and prospect tracking.',
                      icon: CheckSquare,
                      color: 'rose',
                    },
                  ].map((feat, idx) => {
                    const Icon = feat.icon;
                    return (
                      <div
                        key={idx}
                        className="p-5 rounded-2xl border border-slate-200/90 bg-slate-50/50 hover:bg-slate-50 transition space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center font-bold text-blue-600 shadow-xs">
                            <Icon className="w-5 h-5" />
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                            ACTIVE
                          </span>
                        </div>
                        <h4 className="text-sm font-extrabold text-slate-900">{feat.title}</h4>
                        <p className="text-xs text-slate-500 font-medium leading-relaxed">{feat.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 3: GEOFENCE & SHIFTS */}
            {/* ========================================================================= */}
            {activeTab === 'geofence' && (
              <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-xs space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-blue-600" />
                      Office Geolocation & Shift Timing Policies
                    </h2>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Set official office coordinates and attendance perimeter boundaries.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleDetectCurrentLocation}
                    disabled={locatingOffice}
                    className="px-4 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition border border-blue-200 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Compass className={`w-4 h-4 ${locatingOffice ? 'animate-spin' : ''}`} />
                    <span>{locatingOffice ? 'Detecting...' : 'Auto-Detect Current GPS'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Office Latitude (°N)</label>
                    <input
                      type="number"
                      step="any"
                      value={formData.settings.officeLat}
                      onChange={(e) => updateSetting('officeLat', parseFloat(e.target.value) || 0)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Office Longitude (°E)</label>
                    <input
                      type="number"
                      step="any"
                      value={formData.settings.officeLng}
                      onChange={(e) => updateSetting('officeLng', parseFloat(e.target.value) || 0)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Geofence Radius (Meters)</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="50"
                        max="1000"
                        step="25"
                        value={formData.settings.geofenceRadiusMeters}
                        onChange={(e) => updateSetting('geofenceRadiusMeters', parseInt(e.target.value) || 100)}
                        className="flex-1 accent-blue-600"
                      />
                      <span className="w-16 px-2.5 py-1 text-center font-bold text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-lg">
                        {formData.settings.geofenceRadiusMeters}m
                      </span>
                    </div>
                  </div>
                </div>

                {/* Shift Timings */}
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                    Daily Shift & Attendance Timings
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Shift Start Time</label>
                      <input
                        type="time"
                        value={formData.settings.shiftStartTime}
                        onChange={(e) => updateSetting('shiftStartTime', e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Shift End Time</label>
                      <input
                        type="time"
                        value={formData.settings.shiftEndTime}
                        onChange={(e) => updateSetting('shiftEndTime', e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Late Grace Period (Minutes)</label>
                      <input
                        type="number"
                        value={formData.settings.gracePeriodMinutes}
                        onChange={(e) => updateSetting('gracePeriodMinutes', parseInt(e.target.value) || 0)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Policy Toggle Switches */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                  <label className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 cursor-pointer transition">
                    <div>
                      <span className="text-xs font-extrabold text-slate-900 block">Strict Geofence Check-in</span>
                      <span className="text-[11px] text-slate-500 font-medium">Block punch-in if user is outside designated perimeter</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.settings.strictGeofence}
                      onChange={(e) => updateSetting('strictGeofence', e.target.checked)}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer accent-blue-600"
                    />
                  </label>

                  <label className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 cursor-pointer transition">
                    <div>
                      <span className="text-xs font-extrabold text-slate-900 block">Require Selfie on Check-in</span>
                      <span className="text-[11px] text-slate-500 font-medium">User must snap a live front photo when punching in</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.settings.requireSelfieAttendance}
                      onChange={(e) => updateSetting('requireSelfieAttendance', e.target.checked)}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer accent-blue-600"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 4: GPS ENGINE & TELEMETRY */}
            {/* ========================================================================= */}
            {activeTab === 'tracking' && (
              <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-xs space-y-6">
                <div className="border-b border-slate-100 pb-3">
                  <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <Navigation className="w-5 h-5 text-blue-600" />
                    Tracking Engine & Geofencing Policies
                  </h2>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Configure high-precision GPS intervals, jitter distance filters, and accuracy thresholds.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">High-Precision GPS Interval</label>
                    <select
                      value={formData.settings.trackingIntervalSeconds}
                      onChange={(e) => updateSetting('trackingIntervalSeconds', parseInt(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value={15}>15 Seconds (Capture location every 15s on field)</option>
                      <option value={30}>30 Seconds (Recommended Standard)</option>
                      <option value={60}>1 Minute (Battery Saver)</option>
                      <option value={300}>5 Minutes (Eco Low Data)</option>
                    </select>
                    <p className="text-[10px] text-slate-400 mt-1">Capture frequency for active field staff.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Minimum Movement Filter (Meters)</label>
                    <input
                      type="number"
                      value={formData.settings.minDistanceMeters}
                      onChange={(e) => updateSetting('minDistanceMeters', parseInt(e.target.value) || 5)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Discards GPS stationary jitter under this radius.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Max GPS Accuracy Radius (Meters)</label>
                    <input
                      type="number"
                      value={formData.settings.maxAccuracyMeters}
                      onChange={(e) => updateSetting('maxAccuracyMeters', parseInt(e.target.value) || 50)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Filters out coarse cell-tower position estimates.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
                  <label className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 cursor-pointer transition">
                    <div>
                      <span className="text-xs font-extrabold text-slate-900 block">Automated Geofence Breach Alerts</span>
                      <span className="text-[11px] text-slate-500 font-medium">Notify manager immediately when employee leaves assigned site radius</span>
                    </div>
                    <input
                      type="checkbox"
                      defaultChecked
                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer accent-blue-600"
                    />
                  </label>

                  <label className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 cursor-pointer transition">
                    <div>
                      <span className="text-xs font-extrabold text-slate-900 block">Require OTP / Email Verification</span>
                      <span className="text-[11px] text-slate-500 font-medium">Enforce OTP verification on password resets and device logins</span>
                    </div>
                    <input
                      type="checkbox"
                      defaultChecked
                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer accent-blue-600"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 5: EXPENSES & REIMBURSEMENTS */}
            {/* ========================================================================= */}
            {activeTab === 'expenses' && (
              <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-xs space-y-6">
                <div className="border-b border-slate-100 pb-3">
                  <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-blue-600" />
                    Expense Rules & Travel Allowance (TA/DA) Formulas
                  </h2>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Configure reimbursement per KM rates and automatic approval thresholds.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <Bike className="w-3.5 h-3.5 text-blue-600" /> Bike Rate (₹ / km)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={formData.settings.fuelPerKmRateBike}
                      onChange={(e) => updateSetting('fuelPerKmRateBike', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <Car className="w-3.5 h-3.5 text-indigo-600" /> Car Rate (₹ / km)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={formData.settings.fuelPerKmRateCar}
                      onChange={(e) => updateSetting('fuelPerKmRateCar', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Auto-Approve Claims Under</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">₹</span>
                      <input
                        type="number"
                        value={formData.settings.autoApproveLimit}
                        onChange={(e) => updateSetting('autoApproveLimit', parseInt(e.target.value) || 0)}
                        className="w-full pl-7 pr-3 py-2 bg-white rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Mandatory Receipt Above</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">₹</span>
                      <input
                        type="number"
                        value={formData.settings.receiptMandatoryAbove}
                        onChange={(e) => updateSetting('receiptMandatoryAbove', parseInt(e.target.value) || 0)}
                        className="w-full pl-7 pr-3 py-2 bg-white rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 6: VISITS & CLIENT RULES */}
            {/* ========================================================================= */}
            {activeTab === 'meetings' && (
              <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-xs space-y-6">
                <div className="border-b border-slate-100 pb-3">
                  <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-blue-600" />
                    Field Visits & Customer Verification Rules
                  </h2>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Configure compliance rules for store check-ins and client meetings.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Min Meeting Duration (Minutes)</label>
                    <input
                      type="number"
                      value={formData.settings.minMeetingDurationMinutes}
                      onChange={(e) => updateSetting('minMeetingDurationMinutes', parseInt(e.target.value) || 0)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Prevents logging instantaneous fake check-ins.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
                  <label className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 cursor-pointer transition">
                    <div>
                      <span className="text-xs font-extrabold text-slate-900 block">Require Client Digital Signature</span>
                      <span className="text-[11px] text-slate-500 font-medium">Customer signs on mobile screen to close visit</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.settings.requireClientSignature}
                      onChange={(e) => updateSetting('requireClientSignature', e.target.checked)}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer accent-blue-600"
                    />
                  </label>

                  <label className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 cursor-pointer transition">
                    <div>
                      <span className="text-xs font-extrabold text-slate-900 block">Require Geo-Selfie with Client</span>
                      <span className="text-[11px] text-slate-500 font-medium">Executive uploads photo at client store location</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.settings.requireMeetingSelfie}
                      onChange={(e) => updateSetting('requireMeetingSelfie', e.target.checked)}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer accent-blue-600"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* ── Bottom Fixed Action Toolbar (Clean Palette - No Black Buttons) ── */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Ready to apply changes?</h4>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Updates will sync live across web admin and mobile field applications.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 sm:flex-initial py-3.5 px-8 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs shadow-lg shadow-blue-500/25 transition active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'Saving...' : 'Save Organization Logo & Settings'}</span>
                </button>
              </div>
            </div>

          </div>
        )}
      </div>
    </KisanConnectLayout>
  );
}
