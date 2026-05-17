import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import EmployeeLayout from '../../components/layout/EmployeeLayout';
import AdminLayout from '../../components/layout/AdminLayout';
import { authAPI, employeeAPI, uploadAPI } from '../../services/api.service';
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
  const [daAmount, setDaAmount] = useState(user?.DA ?? 0);
  const [daFile, setDaFile] = useState(null);
  const [daPreview, setDaPreview] = useState(user?.daReceipt || '');
  const [uploadingDA, setUploadingDA] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

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

  // Fetch employees list for admin/hr
  React.useEffect(() => {
    let mounted = true;
    const fetchEmployees = async () => {
      if (!isAdmin) return;
      setLoadingEmployees(true);
      try {
        const { data } = await employeeAPI.getAll();
        if (mounted) setEmployees(data.employees || []);
      } catch (err) {
        console.error('Failed to load employees', err);
      } finally { setLoadingEmployees(false); }
    };
    fetchEmployees();
    return () => { mounted = false; };
  }, [isAdmin]);

  const handleDaFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setDaFile(f);
    setDaPreview(URL.createObjectURL(f));
  };

  const handleDaSubmit = async (e) => {
    e.preventDefault();
    if ((daAmount === 0 || daAmount === '' || daAmount === null) && !daFile) return toast.error('Enter amount or attach receipt');
    setUploadingDA(true);
    try {
      const payload = {};
      // Har baar upload par DA ADD ho (replace nahi)
      if (daAmount !== '' && daAmount !== null) {
        const amountNumber = Number(daAmount);
        if (Number.isNaN(amountNumber) || amountNumber < 0) {
          toast.error('Enter a valid DA amount');
          setUploadingDA(false);
          return;
        }
        // server par jo DA currently hai woh read hoke add hoga (we send increment)
        payload.DA = amountNumber;
      }
      if (daFile) {
        const fd = new FormData();
        fd.append('image', daFile);
        const res = await uploadAPI.uploadImage(fd);
        payload.daReceipt = res.data.url;
      }
      if (!Object.keys(payload).length) {
        toast.error('Nothing to update');
        setUploadingDA(false);
        return;
      }
      // increment mode: server DA ko add karega (payload.DA = increment)
      console.log('DA submit payload:', payload);
      const res2 = await authAPI.updateProfile(payload);
      console.log('DA update response user:', res2?.data?.user);
      updateUser(res2.data.user);
      setDaAmount('');
      setDaPreview(res2.data.user.daReceipt || '');
      setDaFile(null);
      toast.success('DA updated');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update DA');
    } finally { setUploadingDA(false); }
  };

  return (
    <Layout>
      <div className="p-4 lg:p-6 space-y-6 max-w-2xl mx-auto">
        <h1 className="text-[var(--text-main)] text-2xl font-bold">Profile</h1>

        {/* Avatar + badge */}
        <div className="glass-card p-6 flex items-center gap-5">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center text-white text-3xl font-bold flex-shrink-0 shadow-glow">
            {user?.avatar ? <img src={user.avatar} alt="" className="w-full h-full rounded-2xl object-cover" /> : user?.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <h2 className="text-[var(--text-main)] text-xl font-bold">{user?.name}</h2>
            <p className="text-[var(--text-muted)] text-sm">{user?.email}</p>
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
              <div className="w-9 h-9 rounded-xl bg-[var(--bg-surface)] flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-[var(--text-muted)] opacity-60" />
              </div>
              <div>
                <p className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-wider">{label}</p>
                <p className="text-[var(--text-main)] text-sm font-semibold">{value || '—'}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Edit profile */}
        <div className="glass-card p-5">
          <h3 className="text-[var(--text-main)] font-semibold mb-4">Edit Profile</h3>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider mb-1.5">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] opacity-50" />
                <input className="input-field pl-10" value={form.name} onChange={set('name')} />
              </div>
            </div>
            <div>
              <label className="block text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider mb-1.5">Phone</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] opacity-50" />
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
          <h3 className="text-[var(--text-main)] font-semibold mb-4 flex items-center gap-2"><Lock className="w-4 h-4 text-[var(--text-muted)]" /> Change Password</h3>
          <form onSubmit={handleChangePw} className="space-y-4">
            {[
              { key: 'currentPassword', label: 'Current Password' },
              { key: 'newPassword', label: 'New Password' },
              { key: 'confirm', label: 'Confirm New Password' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="block text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider mb-1.5">{label}</label>
                <input type="password" className="input-field" value={pwForm[key]} onChange={setPw(key)} required />
              </div>
            ))}
            <button type="submit" disabled={changingPw} className="btn-ghost flex items-center gap-2 py-2.5 px-5">
              {changingPw ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Update Password'}
            </button>
          </form>
        </div>

        {/* Daily Allowance (DA) */}
        <div className="glass-card p-5">
          <h3 className="text-[var(--text-main)] font-semibold mb-4">Daily Allowance (DA)</h3>
          <form onSubmit={handleDaSubmit} className="space-y-4">
            <div>
              <label className="block text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider mb-1.5">Amount</label>
              <input
                className="input-field"
                type="number"
                value={daAmount}
                onChange={(e) => setDaAmount(Number(e.target.value) || 0)}
                placeholder="Enter DA amount"
              />
            </div>
            <div>
              <label className="block text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider mb-1.5">Receipt (optional)</label>
              <input type="file" accept="image/*" onChange={handleDaFile} />
              {daPreview && (
                <img src={daPreview} alt="receipt" className="mt-2 max-h-36 rounded-md object-contain" />
              )}
            </div>
            <div className="flex items-center gap-2">
              <button type="submit" disabled={uploadingDA} className="btn-primary flex items-center gap-2 py-2.5 px-5">
                {uploadingDA ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Upload / Update DA'}
              </button>
            </div>
          </form>
          <div className="mt-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 text-sm text-[var(--text-main)]">
            <p className="font-semibold mb-2">Stored DA details</p>
            <p>Amount: ₹{user?.DA ?? 0}</p>
            {user?.daReceipt ? (
              <p>
                Receipt: <a href={user.daReceipt} target="_blank" rel="noreferrer" className="text-primary-400 underline">View</a>
              </p>
            ) : (
              <p className="text-[var(--text-muted)]">No receipt uploaded yet</p>
            )}
          </div>
        </div>

        {/* Employees list (admin/hr only) */}
        {isAdmin && (
          <div className="glass-card p-5">
            <h3 className="text-[var(--text-main)] font-semibold mb-4">Employees</h3>
            {loadingEmployees ? (
              <p className="text-[var(--text-muted)]">Loading…</p>
            ) : (
              <div className="space-y-3">
                {employees.map(emp => (
                  <div key={emp._id} className="p-3 rounded-xl bg-[var(--bg-surface)] flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{emp.name}</p>
                      <p className="text-[var(--text-muted)] text-sm">{emp.email} • {emp.phone || '—'}</p>
                    </div>
                    <div className="text-sm text-[var(--text-muted)]">{emp.department || '—'}</div>
                  </div>
                ))}
                {employees.length === 0 && <p className="text-[var(--text-muted)]">No employees found</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
