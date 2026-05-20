import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Eye, EyeOff, Zap, MapPin, ArrowRight, Shield } from 'lucide-react';

export default function LoginPage() {
  const { login, authError } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await login(form.email, form.password);
      if (res?.success) {
        if (res.role === 'employee') navigate('/dashboard');
        else if (res.role === 'manager') navigate('/manager');
        else navigate('/admin');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen mesh-bg flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative circles */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full bg-primary-600/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 rounded-full bg-violet-600/10 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-primary-600 flex items-center justify-center shadow-glow">
              <Zap className="w-6 h-6 text-[var(--text-inverse)]" />
            </div>
            <span className="text-2xl font-bold text-[var(--text-main)]">FieldCRM</span>
          </div>
          <p className="text-[var(--text-muted)] text-sm">Enterprise Employee Tracking System</p>
        </div>

        {/* Card */}
        <div className="glass-card p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-[var(--text-main)] mb-1">Welcome back</h2>
            <p className="text-[var(--text-muted)] text-sm">Sign in to your account to continue</p>
          </div>

          {/* Error Alert */}
          {authError && (
            <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2 animate-shake">
              <Shield className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-red-500 text-xs font-bold">Invalide Email Or password</p>
            </div>
          )}

         

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider mb-1.5">Email Address</label>
              <input
                type="email"
                className="input-field"
                placeholder="you@company.com"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                required
              />
            </div>

            <div>
              <label className="block text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  className="input-field pr-11"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  required
                />
                <button type="button" onClick={() => setShow(!show)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors">
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-6 disabled:opacity-60 disabled:cursor-not-allowed">
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>Sign In <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <p className="text-center text-[var(--text-muted)] text-sm mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary-400 hover:text-primary-300 font-semibold transition-colors">
              Register
            </Link>
          </p>
        </div>

        {/* Features row */}
        <div className="flex items-center justify-center gap-6 mt-6">
          {[['📍', 'Live GPS'], ['📊', 'Analytics'], ['💼', 'CRM']].map(([icon, label]) => (
            <div key={label} className="flex items-center gap-1.5 text-[var(--text-muted)] text-xs">
              <span>{icon}</span><span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
