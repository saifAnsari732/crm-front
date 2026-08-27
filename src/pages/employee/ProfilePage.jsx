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
      <div className="p-4 lg:p-8 max-w-[1600px] mx-auto">
        <h1 className="text-[var(--text-main)] text-3xl font-black tracking-tighter uppercase italic mb-8">User Profile</h1>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column */}
          <div className="lg:col-span-4 space-y-8">
            
            {/* Profile Card */}
            <div className="glass-card overflow-hidden shadow-2xl">
              <div className="h-32 bg-gradient-to-br from-teal-500 to-emerald-600 relative mesh-bg"></div>
              <div className="px-6 pb-6 relative">
                <div className="w-24 h-24 rounded-2xl bg-white border-4 border-[var(--bg-main)] shadow-xl flex items-center justify-center text-4xl font-bold -mt-12 mb-4 relative overflow-hidden text-teal-600">
                  {user?.avatar ? <img src={user.avatar} alt="" className="w-full h-full object-cover" /> : user?.name?.[0]?.toUpperCase()}
                </div>
                <h2 className="text-[var(--text-main)] text-xl font-black tracking-tight">{user?.name}</h2>
                <p className="text-[var(--text-muted)] text-sm mb-4">{user?.email}</p>
                <div className="flex flex-wrap gap-2">
                  <span className={`badge ${user?.role === 'employee' ? 'badge-blue' : 'badge-green'} capitalize`}>{user?.role}</span>
                  {user?.employeeId && <span className="badge badge-yellow">{user.employeeId}</span>}
                </div>
              </div>
            </div>

            {/* Work Info */}
            <div className="glass-card p-6 shadow-xl border-[var(--border-color)]">
              <h3 className="text-[var(--text-main)] font-black text-xs uppercase tracking-[0.2em] mb-6">Work Information</h3>
              <div className="space-y-5">
                {[
                  { icon: Building, label: 'Department', value: user?.department },
                  { icon: Shield, label: 'Designation', value: user?.designation },
                  { icon: Calendar, label: 'Joined', value: user?.joiningDate ? new Date(user.joiningDate).toLocaleDateString('en-IN') : '—' },
                  { icon: User, label: 'Manager', value: user?.manager?.name || '—' },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-teal-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-widest">{label}</p>
                      <p className="text-[var(--text-main)] text-sm font-bold truncate">{value || '—'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* DA Settings */}
            <div className="glass-card p-6 shadow-xl border-[var(--border-color)]">
              <h3 className="text-[var(--text-main)] font-black text-xs uppercase tracking-[0.2em] mb-4">Daily Allowance (DA)</h3>
              <form onSubmit={handleDaSubmit} className="space-y-4">
                <div>
                  <label className="block text-[var(--text-muted)] text-xs font-black uppercase tracking-widest mb-2">Amount (₹)</label>
                  <input
                    className="input-field"
                    type="number"
                    value={daAmount}
                    onChange={(e) => setDaAmount(Number(e.target.value) || 0)}
                    placeholder="Enter DA amount"
                  />
                </div>
                <div>
                  <label className="block text-[var(--text-muted)] text-xs font-black uppercase tracking-widest mb-2">Receipt (Optional)</label>
                  <input type="file" accept="image/*" onChange={handleDaFile} className="block w-full text-sm text-[var(--text-muted)] file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 transition-all" />
                  {daPreview && (
                    <img src={daPreview} alt="receipt" className="mt-4 max-h-36 rounded-xl object-cover shadow-sm border border-[var(--border-color)]" />
                  )}
                </div>
                <button type="submit" disabled={uploadingDA} className="btn-primary w-full flex items-center justify-center gap-2 py-3 mt-2">
                  {uploadingDA ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Upload / Update DA'}
                </button>
              </form>
              <div className="mt-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 text-sm text-[var(--text-main)]">
                <p className="font-bold text-xs uppercase tracking-widest text-[var(--text-muted)] mb-2">Stored Details</p>
                <div className="flex justify-between items-center mb-1">
                   <span className="font-semibold text-[var(--text-main)]">Amount:</span>
                   <span className="font-black text-teal-600">₹{user?.DA ?? 0}</span>
                </div>
                {user?.daReceipt ? (
                  <p className="flex justify-between items-center mt-2">
                    <span className="font-semibold text-[var(--text-main)]">Receipt:</span>
                    <a href={user.daReceipt} target="_blank" rel="noreferrer" className="text-teal-600 font-bold hover:underline">View File</a>
                  </p>
                ) : (
                  <p className="text-[var(--text-muted)] text-xs italic mt-2">No receipt uploaded yet</p>
                )}
              </div>
            </div>

          </div>

          {/* Right Column */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* Edit Profile */}
            <div className="glass-card p-6 lg:p-8 shadow-xl border-[var(--border-color)]">
              <h3 className="text-[var(--text-main)] font-black text-lg mb-6">Edit Profile</h3>
              <form onSubmit={handleSave} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[var(--text-muted)] text-xs font-black uppercase tracking-widest mb-2">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                      <input className="input-field pl-11" value={form.name} onChange={set('name')} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[var(--text-muted)] text-xs font-black uppercase tracking-widest mb-2">Phone</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                      <input className="input-field pl-11" type="tel" value={form.phone} onChange={set('phone')} />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2 py-3 px-8">
                    {saving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save className="w-4 h-4" /> Save Changes</>}
                  </button>
                </div>
              </form>
            </div>

            {/* Change Password */}
            <div className="glass-card p-6 lg:p-8 shadow-xl border-[var(--border-color)]">
              <h3 className="text-[var(--text-main)] font-black text-lg mb-6 flex items-center gap-3">
                 <Lock className="w-5 h-5 text-rose-500" />
                 Security Settings
              </h3>
              <form onSubmit={handleChangePw} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[
                    { key: 'currentPassword', label: 'Current Password' },
                    { key: 'newPassword', label: 'New Password' },
                    { key: 'confirm', label: 'Confirm Password' },
                  ].map(({ key, label }) => (
                    <div key={key}>
                      <label className="block text-[var(--text-muted)] text-xs font-black uppercase tracking-widest mb-2">{label}</label>
                      <input type="password" className="input-field" value={pwForm[key]} onChange={setPw(key)} required />
                    </div>
                  ))}
                </div>
                <div className="flex justify-end">
                  <button type="submit" disabled={changingPw} className="bg-rose-500 hover:bg-rose-600 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg active:scale-95 flex items-center gap-2">
                    {changingPw ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Update Password'}
                  </button>
                </div>
              </form>
            </div>

            {/* Employees list (admin/hr only) */}
            {isAdmin && (
              <div className="glass-card p-6 lg:p-8 shadow-xl border-[var(--border-color)]">
                <h3 className="text-[var(--text-main)] font-black text-lg mb-6">Directory Preview</h3>
                {loadingEmployees ? (
                  <div className="flex justify-center p-8"><div className="w-8 h-8 border-4 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" /></div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {employees.map(emp => (
                      <div key={emp._id} className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] flex items-center justify-between hover:border-teal-500/50 transition-colors">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 rounded-full bg-teal-500/10 text-teal-600 font-black flex items-center justify-center uppercase text-sm border border-teal-500/20">
                              {emp.avatar ? <img src={emp.avatar} className="w-full h-full rounded-full object-cover" /> : emp.name?.[0]}
                           </div>
                           <div>
                             <p className="font-bold text-[var(--text-main)] text-sm">{emp.name}</p>
                             <p className="text-[var(--text-muted)] text-[10px] uppercase tracking-widest mt-0.5">{emp.department || '—'}</p>
                           </div>
                        </div>
                      </div>
                    ))}
                    {employees.length === 0 && <p className="text-[var(--text-muted)] italic font-medium col-span-full text-center py-8">No employees found in directory.</p>}
                  </div>
                )}
              </div>
            )}
            
          </div>
        </div>
      </div>
    </Layout>
  );
}
