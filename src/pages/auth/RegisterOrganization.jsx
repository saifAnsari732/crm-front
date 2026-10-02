import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  Building2,
  User,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Check,
  PhoneCall,
  CreditCard,
} from 'lucide-react';
import { initiateRazorpayCheckout } from '../../utils/razorpay';
import toast from 'react-hot-toast';

export default function RegisterOrganization() {
  const { registerOrganization, authError } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    organizationName: '',
    name: '',
    email: '',
    phone: '',
    password: '',
    plan: 'pro',
    billingCycle: 'monthly',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleRegisterAndPay = async (e) => {
    e.preventDefault();
    if (!formData.organizationName || !formData.name || !formData.email || !formData.password) {
      toast.error('Please fill in all required fields.');
      return;
    }

    setLoading(true);

    try {
      // 🏢 Register Organization Account directly and redirect to Dashboard
      const res = await registerOrganization({
        organizationName: formData.organizationName,
        name: formData.name,
        email: formData.email,
        phone: formData.phone || '',
        password: formData.password,
        plan: formData.plan,
        billingCycle: formData.billingCycle,
      });

      if (res?.success) {
        toast.success('🎉 Organization created! Redirecting to Dashboard...');
        navigate('/admin');
      } else {
        toast.error(res?.message || 'Registration failed');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Registration error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafdfb] text-slate-900 flex flex-col justify-between p-4 sm:p-6 lg:p-10 relative overflow-hidden">
      {/* Ambient Orbs */}
      <div className="absolute top-0 left-1/4 w-[700px] h-[500px] bg-emerald-100/40 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[700px] h-[500px] bg-orange-100/30 rounded-full blur-[150px] pointer-events-none" />

      {/* Top Header Bar */}
      <div className="max-w-[1240px] w-full mx-auto flex items-center justify-between z-20 relative mb-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200/90 text-slate-700 text-xs font-black hover:border-emerald-300 hover:text-emerald-700 transition shadow-xs"
        >
          <ArrowLeft className="w-4 h-4 text-emerald-600" />
          <span>Back to Home</span>
        </Link>

        <div className="flex items-center gap-5 text-xs font-bold text-slate-500">
          <div className="hidden sm:flex items-center gap-2 text-slate-600 bg-white px-4 py-2 rounded-full border border-slate-200 shadow-2xs">
            <PhoneCall className="w-4 h-4 text-emerald-600" />
            <span>Support Hotline:</span>
            <a href="tel:9511450914" className="text-emerald-700 font-black hover:underline text-xs">
              +91 9511450914
            </a>
          </div>
          <span>Already registered?</span>
          <Link to="/login" className="text-emerald-600 hover:underline font-black text-xs">
            Sign In
          </Link>
        </div>
      </div>

      {/* Auth Container - Expanded Width (1240px max) */}
      <div className="max-w-[1240px] w-full mx-auto bg-white rounded-3xl sm:rounded-[2.5rem] border border-slate-200/90 shadow-2xl shadow-slate-300/40 overflow-hidden grid grid-cols-1 lg:grid-cols-12 z-10 my-auto">
        {/* Left Side: Brand Panel (5 Cols) */}
        <div className="lg:col-span-5 bg-emerald-700 text-white p-8 sm:p-12 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />

          {/* Top Logo Container - White Background Pill for Crisp Contrast */}
          <div className="relative z-10 flex items-center">
            <div className="bg-white p-2.5 px-4 rounded-2xl shadow-lg border border-slate-100 inline-flex items-center">
              <img
                src="/images/superCompanyLOGO.png"
                alt="Company Logo"
                className="h-10 sm:h-12 w-auto object-contain"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = '/images/icon.jpg';
                }}
              />
            </div>
          </div>

          {/* Middle Brand Content */}
          <div className="my-10 space-y-4 relative z-10">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-800/90 border border-emerald-500/60 text-[11px] font-black uppercase text-amber-300 shadow-xs">
              <CreditCard className="w-3.5 h-3.5 text-amber-300" /> Razorpay Live Verified
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
              Organization SaaS Onboarding
            </h2>
            <p className="text-emerald-100 text-xs sm:text-sm font-semibold leading-relaxed">
              Register your organization workspace to unlock instant 1-second live GPS tracking, geofenced selfie attendance, and automated OCR expense audits.
            </p>

            <div className="pt-3 space-y-3 text-xs font-bold text-emerald-100">
              <div className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-amber-300 stroke-[3]" />
                <span>Instant Subscription Activation</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-300 stroke-[3]" />
                <span>Razorpay HMAC SHA256 Encryption</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-300 stroke-[3]" />
                <span>Multi-Tenant Geofenced Security</span>
              </div>
            </div>
          </div>

          {/* Bottom Switch Pill Button */}
          <div className="pt-6 border-t border-emerald-600 relative z-10">
            <p className="text-xs font-semibold text-emerald-100 mb-3">Already have an active account?</p>
            <Link
              to="/login"
              className="inline-flex items-center justify-center w-full py-3.5 px-6 rounded-2xl bg-white text-emerald-800 hover:bg-emerald-50 font-black text-xs uppercase tracking-wider transition-all duration-300 shadow-md cursor-pointer"
            >
              <span>SIGN IN TO PORTAL</span>
            </Link>
          </div>
        </div>

        {/* Right Side: Form Panel (7 Cols) */}
        <div className="lg:col-span-7 p-8 sm:p-12 flex flex-col justify-between space-y-8">
          <div>
            <div className="mb-8 space-y-1.5">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  Register Your Organization
                </h2>
                <span className="px-3.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Direct Paid Activation
                </span>
              </div>
              <p className="text-slate-500 text-xs sm:text-sm font-semibold">
                Set up your company workspace and organization admin credentials
              </p>
            </div>

            {authError && (
              <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-700 text-xs font-semibold">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleRegisterAndPay} className="space-y-6">
              {/* Form Inputs Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-2">
                    Organization / Company Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-400 absolute left-4 top-4" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Kisan Choice Agro Ltd"
                      value={formData.organizationName}
                      onChange={(e) => handleChange('organizationName', e.target.value)}
                      className="w-full pl-11 pr-4 py-3.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 font-semibold placeholder:text-slate-400 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-2">
                    Admin Full Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-4 top-4" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Saifuddin Ansari"
                      value={formData.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      className="w-full pl-11 pr-4 py-3.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 font-semibold placeholder:text-slate-400 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-2">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-4 top-4" />
                    <input
                      type="tel"
                      placeholder="+91 9511450914"
                      value={formData.phone}
                      onChange={(e) => handleChange('phone', e.target.value)}
                      className="w-full pl-11 pr-4 py-3.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 font-semibold placeholder:text-slate-400 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-2">
                    Work Email Address <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-4" />
                    <input
                      type="email"
                      required
                      placeholder="admin@company.com"
                      value={formData.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      className="w-full pl-11 pr-4 py-3.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 font-semibold placeholder:text-slate-400 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-2">
                    Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-4" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => handleChange('password', e.target.value)}
                      className="w-full pl-11 pr-11 py-3.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 font-semibold placeholder:text-slate-400 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Submit Register Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-xl shadow-emerald-600/25 transition active:scale-95 flex items-center justify-center gap-2.5 disabled:opacity-50 mt-4 cursor-pointer"
              >
                {loading ? (
                  <span>Creating Organization Account...</span>
                ) : (
                  <>
                    <Building2 className="w-5 h-5 text-amber-300" />
                    <span>REGISTER ORGANIZATION & GO TO DASHBOARD</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-semibold">
            <div>
              Already registered?{' '}
              <Link to="/login" className="text-emerald-700 hover:underline font-black">
                Sign In to Portal
              </Link>
            </div>
            <div className="text-slate-400">
              Need assistance? Call Support <a href="tel:9511450914" className="text-emerald-700 font-black">+91 9511450914</a>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1240px] w-full mx-auto text-center text-xs text-slate-400 font-semibold z-20 relative mt-6">
        © {new Date().getFullYear()} KisanConnect SaaS Platform. All rights reserved.
      </div>
    </div>
  );
}
