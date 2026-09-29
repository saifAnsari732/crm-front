import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import TrackProLayout from '../../components/layout/TrackProLayout';
import { authAPI, API } from '../../services/api.service';
import toast from 'react-hot-toast';
import {
  User,
  Mail,
  Phone,
  Building2,
  Calendar,
  Shield,
  Lock,
  Save,
  CheckCircle2,
  Key,
  BadgeCheck,
  MapPin,
  Users,
  Activity,
  Layers,
} from 'lucide-react';
import Avatar from '../../components/shared/Avatar';

export default function ProfilePage() {
  const { user, organization, updateUser } = useAuth();

  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
  });

  const [pwForm, setPwForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirm: '',
  });

  const [orgStats, setOrgStats] = useState({
    totalEmployees: 9,
    totalManagers: 1,
    totalKm: 2323.48,
    presentToday: 0,
    absentToday: 9,
  });

  const [saving, setSaving] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  useEffect(() => {
    const fetchOrgTelemetry = async () => {
      try {
        const res = await API.get('/admin/dashboard');
        if (res.data?.success && res.data.stats) {
          setOrgStats(res.data.stats);
        }
      } catch (err) {
        console.warn('Telemetry fetch error on profile:', err);
      }
    };
    fetchOrgTelemetry();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await authAPI.updateProfile(form);
      updateUser(data.user);
      toast.success('🎉 Profile details updated successfully!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePw = async (e) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirm) {
      return toast.error('Passwords do not match');
    }
    if (pwForm.newPassword.length < 6) {
      return toast.error('New password must be at least 6 characters');
    }
    setChangingPw(true);
    try {
      await authAPI.changePassword({
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });
      toast.success('🔒 Password changed successfully!');
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Password change failed');
    } finally {
      setChangingPw(false);
    }
  };

  const userInitials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'KC';

  return (
    <TrackProLayout>
      <div className="space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Account & Profile</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Manage your personal credentials, contact info, and SaaS organization details.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Profile Card & Organization Info (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            {/* Identity Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 flex flex-col items-center text-center">
              <div className="mb-4">
                <Avatar
                  src={user?.avatar}
                  name={user?.name || 'KISAN CHOICE'}
                  size="3xl"
                  shape="rounded-2xl"
                />
              </div>
              <h3 className="text-lg font-bold text-slate-900">{user?.name || 'KISAN CHOICE'}</h3>
              <p className="text-xs text-slate-500 font-medium mb-3">{user?.email || 'kisandeveloper2@gmail.com'}</p>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                <Shield className="w-3.5 h-3.5" />
                <span>{user?.role === 'ORG_ADMIN' ? 'Organization Admin' : user?.role || 'Admin'}</span>
              </div>
            </div>

            {/* SaaS Organization Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Building2 className="w-4 h-4 text-blue-600" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  SaaS Organization
                </h4>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Company Name</span>
                  <span className="font-bold text-slate-900">{organization?.name || user?.name || 'KISAN CHOICE'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Tenant Slug</span>
                  <span className="font-mono text-slate-700 font-semibold bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                    {organization?.slug || 'kisan-choice'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Subscription Tier</span>
                  <span className="font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                    {organization?.plan?.planName || 'Enterprise Pro'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Capacity</span>
                  <span className="font-bold text-slate-900">
                    {organization?.plan?.maxEmployees || 100} Seats
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Status</span>
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-600">
                    <CheckCircle2 className="w-3 h-3" /> Active
                  </span>
                </div>
              </div>
            </div>

            {/* Live Telemetry Summary Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Activity className="w-4 h-4 text-emerald-600" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Organization Telemetry
                </h4>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Total Tracked Distance</span>
                  <span className="font-bold text-cyan-700 font-mono">
                    {orgStats.totalKm ? orgStats.totalKm.toLocaleString() : '2,323.48'} km
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Registered Employees</span>
                  <span className="font-bold text-slate-900">{orgStats.totalEmployees || 9} Members</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Assigned Managers</span>
                  <span className="font-bold text-slate-900">{orgStats.totalManagers || 1} Manager</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Telemetry Status</span>
                  <span className="font-semibold text-emerald-600">Active Database Sync</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Edit Profile & Password Form (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {/* General Info Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
              <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
                <User className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">Personal Information</h3>
              </div>

              <form onSubmit={handleSave} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Work Email (Authoritative Admin ID)</label>
                  <input
                    type="email"
                    disabled
                    value={user?.email || 'kisandeveloper2@gmail.com'}
                    className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 text-xs cursor-not-allowed font-medium"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs transition disabled:opacity-60"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Change Password Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
              <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
                <Lock className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">Change Password</h3>
              </div>

              <form onSubmit={handleChangePw} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Current Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={pwForm.currentPassword}
                    onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900 text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">New Password</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={pwForm.newPassword}
                      onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
                      required
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Confirm New Password</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={pwForm.confirm}
                      onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
                      required
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900 text-xs"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={changingPw}
                    className="flex items-center gap-2 px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs rounded-xl shadow-xs transition disabled:opacity-60"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>{changingPw ? 'Updating...' : 'Update Password'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </TrackProLayout>
  );
}
