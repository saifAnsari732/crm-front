import React, { useState, useEffect, useRef } from 'react';
import TrackProLayout from '../../components/layout/TrackProLayout';
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
  Bike
} from 'lucide-react';

export default function AdminSettings() {
  const { user, organization: authOrg, updateOrganization } = useAuth();
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
      toast.success('🎉 Organization settings saved successfully!');
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
        toast.success(`📍 Coordinates updated from current location: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
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
    <TrackProLayout>
      <div className="space-y-6 max-w-[1600px] mx-auto">

        {/* Top Header Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center font-black shadow-xs">
              <Sliders className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Organization Control Center</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  Global Configuration
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure brand identity, geofencing perimeters, GPS report frequencies, and expense rules.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={fetchSettings}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Reset</span>
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition active:scale-95 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving Changes...' : 'Save Settings'}</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation Bar */}
        <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-1.5 overflow-x-auto hide-scrollbar">
          {[
            { id: 'general', label: 'Company & Branding', icon: Building2 },
            { id: 'geofence', label: 'Geofence & Shifts', icon: MapPin },
            { id: 'tracking', label: 'GPS & Telemetry', icon: Navigation },
            { id: 'expenses', label: 'Expenses & Reimbursements', icon: Receipt },
            { id: 'meetings', label: 'Field Visits & Client Rules', icon: Briefcase },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
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
          <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
            <p className="text-slate-600 font-bold text-sm">Loading organization settings...</p>
          </div>
        ) : (
          <div className="space-y-6">

            {/* ========================================================================= */}
            {/* TAB 1: COMPANY PROFILE & BRANDING */}
            {/* ========================================================================= */}
            {activeTab === 'general' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* Left Form (8 Cols) */}
                <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">

                  {/* Logo Brand Upload Box */}
                  <div className="p-5 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50/60 via-slate-50/40 to-white flex flex-col sm:flex-row items-center justify-between gap-5">
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
                          className="absolute -bottom-1 -right-1 p-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition shadow-md"
                          title="Change Logo"
                        >
                          <Camera className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Organization Logo & Brand</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Upload PNG, JPG or WEBP logo for mobile portals, tracking reports, and header displays.
                        </p>
                        <span className="inline-block mt-1.5 text-[10px] font-bold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-md">
                          Recommended: 250×250 Transparent PNG
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
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-sm disabled:opacity-50"
                      >
                        {uploadingLogo ? (
                          <RefreshCw className="w-4 h-4 animate-spin text-white" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                        <span>{uploadingLogo ? 'Uploading...' : 'Upload Logo'}</span>
                      </button>

                      {formData.logo && (
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          className="p-2.5 rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          title="Reset to default logo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Company Details Grid */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                      <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-blue-600" />
                        Company Details
                      </h2>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Verified Organization
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Organization Name</label>
                        <div className="relative">
                          <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                          <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Organization Slug</label>
                        <div className="relative">
                          <Globe className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                          <input
                            type="text"
                            disabled
                            value={formData.slug}
                            className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-500 font-mono"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Primary Contact Email</label>
                        <div className="relative">
                          <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                          <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
                            className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Registered Address Section */}
                  <div className="space-y-4 pt-3 border-t border-slate-100">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-blue-600" />
                      Registered Headquarters Address
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Street Address</label>
                        <input
                          type="text"
                          value={formData.address.street}
                          onChange={(e) => updateAddress('street', e.target.value)}
                          placeholder="e.g. Plot No 42, Kisan Bhavan Road"
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

                {/* Right Plan & Summary Card (4 Cols) */}
                <div className="lg:col-span-4 space-y-5">
                  <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-2xl p-6 shadow-xl space-y-5">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center font-bold">
                        <ShieldCheck className="w-5 h-5 text-white" />
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                        ACTIVE LICENSE
                      </span>
                    </div>

                    <div>
                      <h3 className="text-lg font-black tracking-tight">Enterprise Monitoring Plan</h3>
                      <p className="text-xs text-blue-100 mt-1">
                        High-availability multi-tenant field monitoring with real-time GPS websocket feeds.
                      </p>
                    </div>

                    <div className="space-y-2.5 border-t border-white/15 pt-4 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-blue-100">Max Field Agents:</span>
                        <span className="font-bold">50 Seats</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-blue-100">GPS Ping Frequency:</span>
                        <span className="font-bold text-emerald-300">30s Real-Time</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-blue-100">Receipts & Storage:</span>
                        <span className="font-bold">ImageKit Cloud CDN</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-blue-100">Telemetry Health:</span>
                        <span className="font-bold text-emerald-300">100% Operational</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
                    <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-wider">
                      <Info className="w-4 h-4 text-blue-600" /> Need Assistance?
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Custom geofence parameters, automated route replay exports, and API webhooks can be tailored for your field operations.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 2: GEOFENCE & ATTENDANCE */}
            {/* ========================================================================= */}
            {activeTab === 'geofence' && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-blue-600" />
                      Office Geolocation & Shift Timing Policies
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Define headquarters GPS perimeter. Field staff can be restricted to punch in within this perimeter.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleDetectCurrentLocation}
                    disabled={locatingOffice}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition border border-blue-200"
                  >
                    <Compass className={`w-3.5 h-3.5 ${locatingOffice ? 'animate-spin' : ''}`} />
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
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-600" /> Daily Shift & Attendance Timings
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

                {/* Policy Toggles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                  <label className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 cursor-pointer transition">
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">Strict Geofence Check-in</span>
                      <span className="text-[11px] text-slate-500">Block punch-in if user is outside designated perimeter radius</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.settings.strictGeofence}
                      onChange={(e) => updateSetting('strictGeofence', e.target.checked)}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 cursor-pointer transition">
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">Require Selfie on Check-in</span>
                      <span className="text-[11px] text-slate-500">User must snap a live front-camera photo upon punching in</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.settings.requireSelfieAttendance}
                      onChange={(e) => updateSetting('requireSelfieAttendance', e.target.checked)}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 3: TRACKING & GPS TELEMETRY */}
            {/* ========================================================================= */}
            {activeTab === 'tracking' && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
                <div className="border-b border-slate-100 pb-3">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-blue-600" />
                    GPS Tracking & Battery Optimization Policy
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Controls how frequently mobile clients report GPS coordinates and filter out jitter.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Tracking Interval</label>
                    <select
                      value={formData.settings.trackingIntervalSeconds}
                      onChange={(e) => updateSetting('trackingIntervalSeconds', parseInt(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value={15}>15 Seconds (Ultra Precision)</option>
                      <option value={30}>30 Seconds (Recommended)</option>
                      <option value={60}>1 Minute (Battery Saver)</option>
                      <option value={120}>2 Minutes (Low Data)</option>
                      <option value={300}>5 Minutes (Eco)</option>
                    </select>
                    <p className="text-[10px] text-slate-400 mt-1">Mobile client GPS polling cadence.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Minimum Distance Filter (Meters)</label>
                    <input
                      type="number"
                      value={formData.settings.minDistanceMeters}
                      onChange={(e) => updateSetting('minDistanceMeters', parseInt(e.target.value) || 5)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Filters out GPS jitter if movement is smaller than this.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Max Accuracy Allowed (Meters)</label>
                    <input
                      type="number"
                      value={formData.settings.maxAccuracyMeters}
                      onChange={(e) => updateSetting('maxAccuracyMeters', parseInt(e.target.value) || 50)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Discards inaccurate cell tower estimates exceeding this.</p>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 4: EXPENSES & REIMBURSEMENTS */}
            {/* ========================================================================= */}
            {activeTab === 'expenses' && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
                <div className="border-b border-slate-100 pb-3">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-blue-600" />
                    Expense Audit Rules & Reimbursement Thresholds
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Set up automatic approval limits and fuel per-kilometer reimbursement formulas.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Auto-Approve Claims Under</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">₹</span>
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
                      <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">₹</span>
                      <input
                        type="number"
                        value={formData.settings.receiptMandatoryAbove}
                        onChange={(e) => updateSetting('receiptMandatoryAbove', parseInt(e.target.value) || 0)}
                        className="w-full pl-7 pr-3 py-2 bg-white rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

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
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 5: FIELD VISITS & CLIENT RULES */}
            {/* ========================================================================= */}
            {activeTab === 'meetings' && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
                <div className="border-b border-slate-100 pb-3">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-blue-600" />
                    Field Visits, Client Verification & Meeting Rules
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Configure compliance requirements when field executives log customer visits and meetings.
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
                    <p className="text-[10px] text-slate-400 mt-1">Prevents marking instantaneous fake meetings.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
                  <label className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 cursor-pointer transition">
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">Require Client Digital Signature</span>
                      <span className="text-[11px] text-slate-500">Customer must sign on the mobile touch screen to complete visit</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.settings.requireClientSignature}
                      onChange={(e) => updateSetting('requireClientSignature', e.target.checked)}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 cursor-pointer transition">
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">Require Geo-Selfie with Client</span>
                      <span className="text-[11px] text-slate-500">Executive must upload photo with customer at the location</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.settings.requireMeetingSelfie}
                      onChange={(e) => updateSetting('requireMeetingSelfie', e.target.checked)}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </TrackProLayout>
  );
}
