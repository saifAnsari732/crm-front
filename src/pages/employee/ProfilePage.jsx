import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import EmployeeLayout from '../../components/layout/EmployeeLayout';
import AdminLayout from '../../components/layout/AdminLayout';
import { authAPI } from '../../services/api.service';
import toast from 'react-hot-toast';
import { User, Mail, Phone, Building, Calendar, Shield, Lock, Save } from 'lucide-react';

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const isAdmin = user?.role !== 'employee';
  const Layout = isAdmin ? AdminLayout : EmployeeLayout;

  const [form, setForm] = useState({ name: user?.name || '', phone: user?.phone || '' });
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const setPw = k => e => setPwForm(p => ({ ...p, [k]: e.target.value }));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await authAPI.updateProfile(form);
      updateUser(data.user);
      toast.success('Profile updated!');
    } catch { toast.error('Update failed'); }
    finally { setSaving(false); }
  };

  const handleChangePw = async (e) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirm) return toast.error('Passwords do not match');
    if (pwForm.newPassword.length < 6) return toast.error('Min 6 characters');
    setChangingPw(true);
    try {
      await authAPI.changePassword({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      toast.success('Password changed!');
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setChangingPw(false); }
  };

  return (
    <Layout>
      <div className="p-4 lg:p-6 space-y-6 max-w-2xl mx-auto">
        <h1 className="text-white text-2xl font-bold">Profile</h1>

        {/* Avatar + badge */}
        <div className="glass-card p-6 flex items-center gap-5">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center text-white text-3xl font-bold flex-shrink-0 shadow-glow">
            {user?.avatar ? <img src={user.avatar} alt="" className="w-full h-full rounded-2xl object-cover" /> : user?.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <h2 className="text-white text-xl font-bold">{user?.name}</h2>
            <p className="text-white/50 text-sm">{user?.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className={`badge ${user?.role === 'employee' ? 'badge-blue' : 'badge-green'} capitalize`}>{user?.role}</span>
              {user?.employeeId && <span className="badge badge-yellow">{user.employeeId}</span>}
            </div>
          </div>
        </div>

        {/* Info grid */}
        <div className="glass-card p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { icon: Building, label: 'Department', value: user?.department },
            { icon: Shield, label: 'Designation', value: user?.designation },
            { icon: Calendar, label: 'Joined', value: user?.joiningDate ? new Date(user.joiningDate).toLocaleDateString('en-IN') : '—' },
            { icon: User, label: 'Manager', value: user?.manager?.name || '—' },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-white/40" />
              </div>
              <div>
                <p className="text-white/40 text-xs">{label}</p>
                <p className="text-white text-sm font-medium">{value || '—'}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Edit profile */}
        <div className="glass-card p-5">
          <h3 className="text-white font-semibold mb-4">Edit Profile</h3>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-white/60 text-xs font-semibold uppercase tracking-wider mb-1.5">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input className="input-field pl-10" value={form.name} onChange={set('name')} />
              </div>
            </div>
            <div>
              <label className="block text-white/60 text-xs font-semibold uppercase tracking-wider mb-1.5">Phone</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input className="input-field pl-10" type="tel" value={form.phone} onChange={set('phone')} />
              </div>
            </div>
            <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2 py-2.5 px-5">
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save className="w-4 h-4" /> Save Changes</>}
            </button>
          </form>
        </div>

        {/* Change password */}
        <div className="glass-card p-5">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><Lock className="w-4 h-4 text-white/40" /> Change Password</h3>
          <form onSubmit={handleChangePw} className="space-y-4">
            {[
              { key: 'currentPassword', label: 'Current Password' },
              { key: 'newPassword', label: 'New Password' },
              { key: 'confirm', label: 'Confirm New Password' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="block text-white/60 text-xs font-semibold uppercase tracking-wider mb-1.5">{label}</label>
                <input type="password" className="input-field" value={pwForm[key]} onChange={setPw(key)} required />
              </div>
            ))}
            <button type="submit" disabled={changingPw} className="btn-ghost flex items-center gap-2 py-2.5 px-5">
              {changingPw ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
