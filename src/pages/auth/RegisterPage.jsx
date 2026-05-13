import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../../services/api.service';
import toast from 'react-hot-toast';
import { Zap, ArrowRight, User, Mail, Phone, Lock, Briefcase } from 'lucide-react';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', department: '', designation: '' });
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authAPI.register(form);
      toast.success('Registration submitted! Awaiting admin approval.');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const departments = ['Sales', 'Marketing', 'Operations', 'Logistics', 'Field Services', 'Support', 'Other'];

  return (
    <div className="min-h-screen mesh-bg flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full bg-primary-600/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 rounded-full bg-emerald-600/8 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-primary-600 flex items-center justify-center shadow-glow">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-[var(--text-main)]">FieldCRM</span>
          </div>
          <p className="text-[var(--text-muted)] text-sm">Create your employee account</p>
        </div>

        <div className="glass-card p-8">
          <h2 className="text-2xl font-bold text-[var(--text-main)] mb-1">Join FieldCRM</h2>
          <p className="text-[var(--text-muted)] text-sm mb-6 opacity-70">Fill in your details to request access</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <InputField label="Full Name" icon={User} placeholder="John Doe" value={form.name} onChange={set('name')} required />
              <InputField label="Email Address" icon={Mail} type="email" placeholder="john@company.com" value={form.email} onChange={set('email')} required />
              <InputField label="Phone Number" icon={Phone} type="tel" placeholder="+91 98765 43210" value={form.phone} onChange={set('phone')} />
              <InputField label="Password" icon={Lock} type="password" placeholder="Min 6 characters" value={form.password} onChange={set('password')} required />
            </div>

            <div>
              <label className="block text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-widest mb-1.5 opacity-80">Department</label>
              <select className="input-field" value={form.department} onChange={set('department')}>
                <option value="">Select Department</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <InputField label="Designation / Role" icon={Briefcase} placeholder="e.g. Field Executive" value={form.designation} onChange={set('designation')} />

            <button type="submit" disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-2 disabled:opacity-60">
              {loading
                ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <><span>Submit Request</span><ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <p className="text-center text-[var(--text-muted)] text-sm mt-5">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-500 hover:text-primary-400 font-bold">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function InputField({ label, icon: Icon, ...props }) {
  return (
    <div>
      <label className="block text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-widest mb-1.5 opacity-80">{label}</label>
      <div className="relative">
        {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] opacity-50" />}
        <input className={`input-field ${Icon ? 'pl-10' : ''}`} {...props} />
      </div>
    </div>
  );
}
