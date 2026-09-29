import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../../services/api.service';
import toast from 'react-hot-toast';
import { MapPin, ArrowRight, ArrowLeft, User, Mail, Phone, Lock, Briefcase, Building2, ShieldCheck, Eye, EyeOff } from 'lucide-react';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', department: '', designation: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authAPI.register(form);
      toast.success('Registration submitted! You can now log in.');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const departments = ['Sales', 'Marketing', 'Operations', 'Logistics', 'Field Services', 'Support', 'Agriculture', 'Other'];

  return (
    <div className="min-h-screen bg-[#fafdfb] text-slate-900 flex flex-col justify-between p-4 sm:p-6 lg:p-10 relative overflow-hidden">
      {/* Background Ambient Orbs */}
      <div className="absolute top-0 right-1/4 w-[600px] h-[400px] bg-emerald-100/40 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[600px] h-[400px] bg-orange-100/30 rounded-full blur-[140px] pointer-events-none" />

      {/* Top Header Bar with Back Page Link */}
      <div className="max-w-6xl w-full mx-auto flex items-center justify-between z-20 relative mb-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200/90 text-slate-700 text-xs font-black hover:border-emerald-300 hover:text-emerald-700 transition shadow-xs"
        >
          <ArrowLeft className="w-4 h-4 text-emerald-600" />
          <span>Back to Home</span>
        </Link>

        <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
          <span>Already have an account?</span>
          <Link to="/login" className="text-emerald-600 hover:underline font-black">Sign In</Link>
        </div>
      </div>

      {/* Main Split Card Auth Container */}
      <div className="max-w-5xl w-full mx-auto bg-white rounded-3xl sm:rounded-[2.5rem] border border-slate-200/90 shadow-2xl shadow-slate-300/40 overflow-hidden grid grid-cols-1 lg:grid-cols-12 z-10 my-auto">
        {/* Left Side: Brand Panel */}
        <div className="lg:col-span-5 bg-emerald-600 text-white p-8 sm:p-12 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />

          {/* Top Logo Image Only - Enlarged, No outer box, No side text */}
          <div className="relative z-10 flex items-center">
            <img
              src="/images/superCompanyLOGO.png"
              alt="Company Logo"
              className="h-14 sm:h-16 w-auto object-contain drop-shadow-md"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = '/images/icon.jpg';
              }}
            />
          </div>

          {/* Middle Content */}
          <div className="my-10 space-y-4 relative z-10">
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
              Create Account
            </h2>
            <p className="text-emerald-100 text-xs sm:text-sm font-semibold leading-relaxed">
              Enter your details to join your organization's field operations & telemetry team.
            </p>

            <div className="pt-4 space-y-2.5 text-xs font-bold text-emerald-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-200" />
                <span>Geofenced Selfie Attendance</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-200" />
                <span>Automated Mileage Reclaims</span>
              </div>
            </div>
          </div>

          {/* Bottom Switch Pill Button */}
          <div className="pt-4 border-t border-emerald-500/80 relative z-10">
            <p className="text-xs font-semibold text-emerald-100 mb-3">Already registered with your company?</p>
            <Link
              to="/login"
              className="inline-flex items-center justify-center w-full py-3 px-6 rounded-full border-2 border-white/90 hover:bg-white hover:text-emerald-700 text-white font-black text-xs uppercase tracking-wider transition-all duration-300 shadow-sm"
            >
              <span>Sign In Instead</span>
            </Link>
          </div>
        </div>

        {/* Right Side: Form Panel */}
        <div className="lg:col-span-7 p-8 sm:p-12 flex flex-col justify-between space-y-6">
          <div>
            <div className="mb-6 space-y-1">
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Employee Signup
              </h2>
              <p className="text-slate-500 text-xs sm:text-sm font-semibold">
                Fill in your details below to set up your account
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1.5">
                  Full Name <span className="text-emerald-600">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
                  <input
                    type="text"
                    required
                    placeholder="Saifuddin Ansari"
                    value={form.name}
                    onChange={set('name')}
                    className="w-full pl-11 pr-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 font-semibold placeholder:text-slate-400 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1.5">
                  Work Email Address <span className="text-emerald-600">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
                  <input
                    type="email"
                    required
                    placeholder="saifuddin@company.com"
                    value={form.email}
                    onChange={set('email')}
                    className="w-full pl-11 pr-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 font-semibold placeholder:text-slate-400 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1.5">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
                    <input
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={form.phone}
                      onChange={set('phone')}
                      className="w-full pl-11 pr-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 font-semibold placeholder:text-slate-400 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1.5">
                    Department
                  </label>
                  <select
                    value={form.department}
                    onChange={set('department')}
                    className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 font-semibold transition"
                  >
                    <option value="">Select Department</option>
                    {departments.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1.5">
                  Designation / Role
                </label>
                <div className="relative">
                  <Briefcase className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
                  <input
                    type="text"
                    placeholder="e.g. Senior Field Executive"
                    value={form.designation}
                    onChange={set('designation')}
                    className="w-full pl-11 pr-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 font-semibold placeholder:text-slate-400 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1.5">
                  Password <span className="text-emerald-600">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={form.password}
                    onChange={set('password')}
                    className="w-full pl-11 pr-11 py-3 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 font-semibold placeholder:text-slate-400 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-3.5 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-4 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-2xl shadow-xl shadow-emerald-600/25 transition active:scale-95 flex items-center justify-center gap-2.5 disabled:opacity-60 cursor-pointer"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>SIGN UP</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="pt-6 border-t border-slate-100 text-center text-xs text-slate-500 font-semibold">
            Registering a new company?{' '}
            <Link to="/register-organization" className="text-orange-600 hover:underline font-black">
              Organization SaaS Signup
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl w-full mx-auto text-center text-xs text-slate-400 font-semibold z-20 relative mt-6">
        © {new Date().getFullYear()} TrackPro SaaS Platform. All rights reserved.
      </div>
    </div>
  );
}
