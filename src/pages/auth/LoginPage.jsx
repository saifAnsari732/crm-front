import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { authAPI } from '../../services/api.service';
import toast from 'react-hot-toast';
import {
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Lock,
  Mail,
  Building2,
  ShieldCheck,
  PhoneCall,
  Key,
  CheckCircle,
  X,
  RefreshCw,
} from 'lucide-react';

export default function LoginPage() {
  const { login, authError } = useAuth();
  const navigate = useNavigate();

  // Login Form State
  const [form, setForm] = useState({ email: '', password: '' });
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  // Forgot Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1 = Request OTP, 2 = Verify OTP & Reset
  const [forgotEmail, setForgotEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState(null);

  // Detect password reset link from email URL (e.g. ?email=...&otp=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlEmail = params.get('email');
    const urlOtp = params.get('otp') || params.get('resetToken');

    if (urlEmail) {
      setForgotEmail(urlEmail);
      if (urlOtp) {
        setOtpCode(urlOtp);
      }
      setForgotStep(2);
      setForgotMsg({
        type: 'success',
        text: `🔐 Reset link verified for ${urlEmail}. Enter OTP and set your new password.`,
      });
      setShowForgotModal(true);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await login(form.email, form.password);
      if (res?.success) {
        const userRole = res.role ? res.role.toUpperCase() : '';
        if (userRole === 'SUPER_ADMIN' || userRole === 'SUPERADMIN') {
          navigate('/super-admin');
        } else {
          navigate('/admin');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Request OTP via email
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      setForgotMsg({ type: 'error', text: 'Please enter your registered work email.' });
      return;
    }

    setForgotLoading(true);
    setForgotMsg(null);
    setOtpCode('');

    try {
      const res = await authAPI.forgotPassword(forgotEmail.trim());
      setForgotStep(2);
      setForgotMsg({
        type: 'success',
        text: res.data?.message || `📩 OTP sent to ${forgotEmail}. Check your inbox.`,
      });
      toast.success('📩 Reset code sent to your email!');
    } catch (err) {
      console.error('Request OTP error:', err);
      const msg = err.response?.data?.message || err.message || 'Failed to send OTP. Please check your email and try again.';
      setForgotMsg({ type: 'error', text: msg });
      toast.error(msg);
    } finally {
      setForgotLoading(false);
    }
  };

  // Step 2: Verify OTP & Reset Password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!otpCode.trim()) {
      setForgotMsg({ type: 'error', text: 'Please enter the verification OTP code.' });
      return;
    }
    if (newPassword.length < 6) {
      setForgotMsg({ type: 'error', text: 'New password must be at least 6 characters long.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setForgotMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    setForgotLoading(true);
    setForgotMsg(null);

    try {
      await authAPI.resetPassword({
        email: forgotEmail.trim(),
        otp: otpCode.trim(),
        newPassword: newPassword,
      });

      toast.success('🎉 Password updated successfully! Please sign in.');
      setForm({ email: forgotEmail.trim(), password: '' });
      setShowForgotModal(false);
      setForgotStep(1);
      setForgotEmail('');
      setOtpCode('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error('Reset password error:', err);
      const msg = err.response?.data?.message || err.message || 'Password reset failed. Please check OTP and try again.';
      setForgotMsg({ type: 'error', text: msg });
      toast.error(msg);
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafdfb] text-slate-900 flex flex-col justify-between p-4 sm:p-6 lg:p-10 relative overflow-hidden">
      {/* Background Ambient Orbs */}
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

        <div className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-white px-4 py-2 rounded-full border border-slate-200 shadow-2xs">
          <PhoneCall className="w-4 h-4 text-emerald-600" />
          <span>Contact Support:</span>
          <a href="tel:9511450914" className="text-emerald-700 hover:underline font-black text-xs">
            +91 9511450914
          </a>
        </div>
      </div>

      {/* Main Split Card Auth Container (1240px max) */}
      <div className="max-w-[1240px] w-full mx-auto bg-white rounded-3xl sm:rounded-[2.5rem] border border-slate-200/90 shadow-2xl shadow-slate-300/40 overflow-hidden grid grid-cols-1 lg:grid-cols-12 z-10 my-auto">
        {/* Left Side: Brand Panel (5 Cols) */}
        <div className="lg:col-span-5 bg-emerald-700 text-white p-8 sm:p-12 flex flex-col justify-between relative overflow-hidden">
          {/* Decorative Subtle Geometry Orbs */}
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />

          {/* Top Logo Container - White Background Badge */}
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

          {/* Middle Content */}
          <div className="my-10 space-y-4 relative z-10">
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
              Welcome Back!
            </h2>
            <p className="text-emerald-100 text-xs sm:text-sm font-semibold leading-relaxed">
              To keep connected with your field force operations, please sign in with your organization credentials.
            </p>

            <div className="pt-4 space-y-3 text-xs font-bold text-emerald-100">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-200" />
                <span>Multi-Tenant Geofence Security</span>
              </div>
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-200" />
                <span>Real-Time GPS Telemetry Sync</span>
              </div>
            </div>
          </div>

          {/* Bottom Switch Pill Button */}
          <div className="pt-6 border-t border-emerald-600 relative z-10">
            <p className="text-xs font-semibold text-emerald-100 mb-3">Don't have an organization account yet?</p>
            <Link
              to="/register-organization"
              className="inline-flex items-center justify-center w-full py-3.5 px-6 rounded-2xl bg-white text-emerald-800 hover:bg-emerald-50 font-black text-xs uppercase tracking-wider transition-all duration-300 shadow-md cursor-pointer"
            >
              <span>REGISTER ORGANIZATION</span>
            </Link>
          </div>
        </div>

        {/* Right Side: Form Panel (7 Cols) */}
        <div className="lg:col-span-7 p-8 sm:p-12 flex flex-col justify-between space-y-8">
          <div>
            <div className="mb-8 space-y-1.5">
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Sign In to Portal
              </h2>
              <p className="text-slate-500 text-xs sm:text-sm font-semibold">
                Enter your work email and password to access your dashboard
              </p>
            </div>

            {/* Error Alert */}
            {authError && (
              <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-700 text-xs font-semibold">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            {/* Form Fields */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-2">
                  Work Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-4" />
                  <input
                    type="email"
                    className="w-full pl-11 pr-4 py-3.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 font-semibold placeholder:text-slate-400 transition"
                    placeholder="name@company.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(form.email || '');
                      setForgotStep(1);
                      setForgotMsg(null);
                      setOtpCode('');
                      setShowForgotModal(true);
                    }}
                    className="text-xs font-extrabold text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-4" />
                  <input
                    type={show ? 'text' : 'password'}
                    className="w-full pl-11 pr-4 py-3.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 font-semibold placeholder:text-slate-400 transition"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShow(!show)}
                    className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 transition"
                  >
                    {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
                    <span>SIGN IN</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Registration Option Footer */}
          <div className="pt-6 border-t border-slate-100">
            <Link
              to="/register-organization"
              className="w-full py-3.5 px-6 border-2 border-emerald-600 hover:bg-emerald-600 text-emerald-700 hover:text-white font-black text-xs rounded-2xl transition duration-200 flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              <Building2 className="w-4 h-4" />
              <span>Register New Organization</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ─── FORGOT PASSWORD MODAL ────────────────────────────────────────── */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 sm:p-8 space-y-6 relative animate-in fade-in zoom-in duration-200">
            {/* Close Button */}
            <button
              onClick={() => setShowForgotModal(false)}
              className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <Key className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                {forgotStep === 1 ? 'Reset Your Password' : 'Verify Code & Set Password'}
              </h3>
              <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                {forgotStep === 1
                  ? 'Enter your registered work email address to receive a secure password reset verification code.'
                  : `Enter the OTP verification code received in your email inbox to set your new password.`}
              </p>
            </div>

            {/* Status Message */}
            {forgotMsg && (
              <div
                className={`p-4 rounded-2xl border flex items-start gap-3 text-xs font-semibold ${
                  forgotMsg.type === 'error'
                    ? 'bg-rose-50 border-rose-200 text-rose-700'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                }`}
              >
                {forgotMsg.type === 'error' ? (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                )}
                <span>{forgotMsg.text}</span>
              </div>
            )}

            {/* STEP 1 FORM: REQUEST OTP / EMAIL LINK */}
            {forgotStep === 1 ? (
              <form onSubmit={handleRequestOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-2">
                    Work Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-4" />
                    <input
                      type="email"
                      className="w-full pl-11 pr-4 py-3.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 font-semibold placeholder:text-slate-400 transition"
                      placeholder="name@company.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-2xl shadow-lg shadow-emerald-600/25 transition active:scale-95 flex items-center justify-center gap-2.5 disabled:opacity-60 cursor-pointer"
                >
                  {forgotLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      <span>SEND RESET EMAIL LINK</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* STEP 2 FORM: VERIFY OTP & NEW PASSWORD */
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium">Email: <strong className="text-slate-900">{forgotEmail}</strong></span>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotStep(1);
                      setForgotMsg(null);
                    }}
                    className="text-emerald-700 font-black hover:underline cursor-pointer"
                  >
                    Change
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-2">
                    Verification OTP Code
                  </label>
                  <div className="relative">
                    <Key className="w-4 h-4 text-slate-400 absolute left-4 top-4" />
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      name="otp_verification_code"
                      autoComplete="off"
                      className="w-full pl-11 pr-4 py-3.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 font-mono font-bold placeholder:text-slate-400 transition tracking-widest"
                      placeholder="Enter 6-digit OTP code"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      required
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-400 font-medium">Check your email inbox for the 6-digit code. Expires in 10 minutes.</p>
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-4" />
                    <input
                      type={showNewPass ? 'text' : 'password'}
                      className="w-full pl-11 pr-11 py-3.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 font-semibold placeholder:text-slate-400 transition"
                      placeholder="At least 6 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 transition"
                    >
                      {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-2">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-4" />
                    <input
                      type={showNewPass ? 'text' : 'password'}
                      className="w-full pl-11 pr-4 py-3.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 font-semibold placeholder:text-slate-400 transition"
                      placeholder="Repeat new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRequestOtp}
                  disabled={forgotLoading}
                  className="w-full py-2.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Didn't receive OTP? Resend Code</span>
                </button>

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-2xl shadow-lg shadow-emerald-600/25 transition active:scale-95 flex items-center justify-center gap-2.5 disabled:opacity-60 cursor-pointer"
                >
                  {forgotLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>RESET PASSWORD & CONTINUE</span>
                    </>
                  )}
                </button>
              </form>
            )}

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 transition cursor-pointer"
              >
                Back to Sign In
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page Footer Copyright */}
      <div className="max-w-[1240px] w-full mx-auto text-center text-xs text-slate-400 font-semibold z-20 relative mt-6">
        © {new Date().getFullYear()} KisanConnect SaaS Platform. All rights reserved.
      </div>
    </div>
  );
}
