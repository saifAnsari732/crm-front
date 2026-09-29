import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin,
  ShieldCheck,
  Zap,
  Users,
  Clock,
  TrendingUp,
  Receipt,
  Briefcase,
  CheckCircle2,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Play,
  Star,
  Building2,
  Navigation,
  Check,
  HelpCircle,
  Smartphone,
  Globe,
  Database,
  Cpu,
  Layers,
  MessageSquare,
  Lock,
  Menu,
  X,
  Compass,
  BarChart3,
  Award,
  Bell,
  Activity,
  UserCheck,
  ArrowUpRight,
  PhoneCall,
  Laptop,
  ShoppingBag,
  Wrench,
  Truck,
} from 'lucide-react';
import { initiateRazorpayCheckout } from '../../utils/razorpay';

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' | 'yearly'
  const [activeTab, setActiveTab] = useState('sales');
  const [openFaq, setOpenFaq] = useState(0);

  // Mouse Cursor Interactive Spotlight Effect State
  const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 });

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const industries = [
    {
      id: 'sales',
      label: 'Field Sales & CRM',
      icon: Briefcase,
      badge: 'Sales Force Automation',
      title: 'Enterprise Field Sales & Lead CRM Automation',
      desc: 'Streamline daily client meetings, B2B deal closures, digital signatures, and route tracking for sales representatives.',
      process: ['Auto Beat Assignment', 'Geofenced Client Check-in', 'Instant Order & Signature Sync'],
      kpis: ['+35% More Meetings', 'Zero Proxy Check-ins', 'Real-Time CRM Sync', 'Auto Mileage Audit'],
      cardTitle: 'B2B Sales Meeting Check-in',
      cardSub: 'Enterprise Sales Rep • Live Tracking',
      mockupType: 'sales',
    },
    {
      id: 'fmcg',
      label: 'FMCG & Retail Distribution',
      icon: ShoppingBag,
      badge: 'Beat Route Optimization',
      title: 'FMCG Order Booking & Retail Beat Execution',
      desc: 'Empower retail sales reps with automated store visit routes, real-time stock audits, and digital order booking logs.',
      process: ['Beat Route Mapping', 'Retailer Store Check-in', 'Digital Order Booking'],
      kpis: ['35% Faster Order Sync', '100% Store Audit', 'Automatic Route KM', 'Stock Verification'],
      cardTitle: 'Retail Store Beat Execution',
      cardSub: 'FMCG Executive • 12 Stores Completed',
      mockupType: 'fmcg',
    },
    {
      id: 'service',
      label: 'Field Service & Maintenance',
      icon: Wrench,
      badge: 'Technician Dispatch Suite',
      title: 'Field Service Technician & Equipment Maintenance',
      desc: 'Track field engineers, service ticket dispatching, on-site arrival verification, and customer job completion sign-offs.',
      process: ['Ticket Dispatch', 'On-Site GPS Arrival', 'Customer Sign-off Log'],
      kpis: ['45 Min SLA Response', 'Photo & Selfie Log', 'Parts & Cost Audit', 'Geo-Stamped Arrival'],
      cardTitle: 'On-Site Repair Dispatch Ticket',
      cardSub: 'HVAC & Telecom Field Engineer',
      mockupType: 'service',
    },
    {
      id: 'logistics',
      label: 'Logistics & Courier Fleets',
      icon: Truck,
      badge: 'Last-Mile Fleet Telemetry',
      title: 'Last-Mile Express Courier & Rider Telemetry',
      desc: 'Monitor courier riders and delivery fleets with 1-sec GPS telemetry, speed warnings, and automatic fuel rate calculation.',
      process: ['Live Rider Telemetry', 'Parcel Delivery Verification', 'Fuel Mileage Calculation'],
      kpis: ['24% Saved Fuel Expense', 'Live Speed Alerts', 'Auto Haversine KM', 'Over-Speed Warnings'],
      cardTitle: 'Courier Fleet Live Telemetry',
      cardSub: 'Delivery Rider #14 • 18.4 km Tracked',
      mockupType: 'logistics',
    },
    {
      id: 'construction',
      label: 'Construction & Civil Sites',
      icon: Building2,
      badge: 'Civil Site Attendance',
      title: 'Civil Engineering & Contractor Site Attendance',
      desc: 'Enforce facial selfie attendance inside site geofence perimeters. Prevent unauthorized off-site attendance punch-ins.',
      process: ['Site Geofence Radius', 'Selfie Photo Punch', 'Contractor Audit Log'],
      kpis: ['Strict Geofence Radius', 'Mandatory Selfie Log', 'Contractor Audit', 'Shift Grace Control'],
      cardTitle: 'Civil Site Perimeter Audit',
      cardSub: 'Site #4 Delhi NCR • 42 Present Today',
      mockupType: 'construction',
    },
  ];

  return (
    <div className="min-h-screen bg-[#fafdfb] text-slate-900 font-sans selection:bg-orange-500 selection:text-white scroll-smooth">
      {/* ─── 1. HEADER / NAVIGATION (CLEAN MODERN LAYOUT) ────── */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-2xs transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Prominent Company Brand Logo without Outer Box */}
          <Link to="/" className="flex items-center group">
            <img
              src="/images/superCompanyLOGO.png"
              alt="TrackPro Logo"
              className="h-36 sm:h-12 w-auto lg:h-28  object-contain transition-transform group-hover:scale-105"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = '/images/icon.jpg';
              }}
            />
          </Link>

          {/* Nav Links - Clean Plain Text without Icons */}
          <nav className="hidden lg:flex items-center gap-8 text-md font-black text-slate-700">
            <a href="#features" className="hover:text-emerald-600 transition-colors">
              Features
            </a>
            <a href="#solutions" className="hover:text-emerald-600 transition-colors">
              Solutions
            </a>
            <a href="#how-it-works" className="hover:text-emerald-600 transition-colors">
              How It Works
            </a>
            <a href="#pricing" className="hover:text-emerald-600 transition-colors">
              Pricing
            </a>
            <a href="#testimonials" className="hover:text-emerald-600 transition-colors">
              Reviews
            </a>
            <a href="#faq" className="hover:text-emerald-600 transition-colors">
              FAQ
            </a>
          </nav>

          {/* Action CTAs */}
          <div className="hidden sm:flex items-center gap-3">
            <Link
              to="/login"
              className="px-5 py-2.5 rounded-xl border border-slate-200 hover:border-emerald-300 text-slate-800 text-xs font-black hover:bg-emerald-50/50 transition shadow-2xs"
            >
              Sign In
            </Link>
            <Link
              to="/register-organization"
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-600/20 transition active:scale-95 flex items-center gap-2"
            >
              <span>Get Started Free</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2.5 rounded-xl text-slate-700 hover:bg-slate-100 transition"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-b border-slate-200 px-6 py-6 space-y-4 shadow-2xl">
            <nav className="flex flex-col space-y-3 text-sm font-bold text-slate-700">
              <a href="#features" onClick={() => setMobileMenuOpen(false)}>Features</a>
              <a href="#solutions" onClick={() => setMobileMenuOpen(false)}>Solutions</a>
              <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)}>How It Works</a>
              <a href="#pricing" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
              <a href="#testimonials" onClick={() => setMobileMenuOpen(false)}>Reviews</a>
              <a href="#faq" onClick={() => setMobileMenuOpen(false)}>FAQ</a>
            </nav>
            <div className="pt-4 border-t border-slate-100 flex flex-col gap-2.5">
              <Link
                to="/login"
                className="w-full text-center py-3 rounded-xl border border-slate-200 text-slate-800 font-bold text-sm"
              >
                Sign In
              </Link>
              <Link
                to="/register-organization"
                className="w-full text-center py-3 rounded-xl bg-emerald-600 text-white font-bold text-sm shadow-md"
              >
                Get Started Free →
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ─── 2. HERO SECTION (EXPANDED HEIGHT & WIDTH WITH INTERACTIVE MOUSE SPOTLIGHT) ────── */}
      <section
        onMouseMove={handleMouseMove}
        className="relative pt-12 pb-20 sm:pt-20 sm:pb-28 min-h-[90vh] overflow-hidden bg-gradient-to-b from-emerald-50/70 via-white to-slate-50 flex flex-col justify-center"
      >
        {/* Interactive Mouse Cursor Glow Effect */}
        <div
          className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-300 opacity-80"
          style={{
            background: `radial-gradient(650px circle at ${mousePos.x}px ${mousePos.y}px, rgba(16, 185, 129, 0.12), rgba(249, 115, 22, 0.08), transparent 80%)`,
          }}
        />

        {/* Ambient Top Radial Background Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[550px] bg-gradient-to-b from-emerald-200/40 via-orange-100/35 to-transparent blur-[160px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-8">
          <div className="text-center max-w-5xl lg:max-w-6xl mx-auto space-y-6">
            {/* Release Pill Badge */}
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white border border-slate-200/90 text-slate-800 text-xs font-extrabold shadow-sm hover:border-emerald-300 transition-all hover:scale-105 cursor-pointer">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider">
                NEW 2.0
              </span>
              <span>Multi-Tenant Organization Telemetry Platform Released</span>
              <ArrowRight className="w-3.5 h-3.5 text-emerald-600" />
            </div>

            {/* High-Impact Centered Headline (EXPANDED FONT SIZE & LINE HEIGHT) */}
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-slate-900 tracking-tight leading-[1.1] max-w-5xl mx-auto">
              Boost Your <span className="text-emerald-600">Field Operations</span>,<br className="hidden sm:inline" /> Simplify Your <span className="text-orange-500">Attendance</span>
            </h1>

            {/* Self-Conceived 5 Core Feature Callouts Bar (INCREASED SPACING & SHADOW) */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2 pb-2 max-w-4xl mx-auto">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-emerald-200 text-xs font-bold text-emerald-800 shadow-sm hover:scale-105 transition-transform">
                <Zap className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
                <span>1-Sec Telemetry</span>
              </span>
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-orange-200 text-xs font-bold text-orange-800 shadow-sm hover:scale-105 transition-transform">
                <MapPin className="w-3.5 h-3.5 text-orange-500" />
                <span>15m Geofence Perimeter</span>
              </span>
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-amber-200 text-xs font-bold text-amber-800 shadow-sm hover:scale-105 transition-transform">
                <Receipt className="w-3.5 h-3.5 text-amber-600" />
                <span>Auto Haversine Mileage</span>
              </span>
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-blue-200 text-xs font-bold text-blue-800 shadow-sm hover:scale-105 transition-transform">
                <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                <span>Offline Data Sync</span>
              </span>
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-purple-200 text-xs font-bold text-purple-800 shadow-sm hover:scale-105 transition-transform">
                <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                <span>Facial Selfie Punch</span>
              </span>
            </div>

            {/* Expanded Subheading */}
            <p className="text-base sm:text-lg text-slate-600 font-semibold leading-relaxed max-w-3xl mx-auto">
              We're here to simplify field force tracking with real-time GPS telemetry, geofenced selfie attendance, and automated mileage audits in one unified platform.
            </p>

            {/* High-Impact Solid Pill Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <Link
                to="/register-organization"
                className="w-full sm:w-auto px-9 py-4 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base shadow-xl shadow-emerald-600/30 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2.5"
              >
                <span>Get Started Free</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
              <a
                href="#video-demo"
                className="w-full sm:w-auto px-8 py-4 rounded-full bg-white border-2 border-emerald-500/80 hover:bg-emerald-50/50 text-emerald-700 font-black text-base shadow-sm transition-all hover:scale-105 flex items-center justify-center gap-2.5"
              >
                <Play className="w-5 h-5 fill-emerald-600 text-emerald-600" />
                <span>Watch Video Tour</span>
              </a>
            </div>

            {/* Micro Trust Badges */}
            <div className="pt-2 flex items-center justify-center gap-6 text-xs font-bold text-slate-500 flex-wrap">
              <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> No Credit Card Required</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-orange-500" /> Setup in 3 Minutes</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> 24/7 Priority Support</span>
            </div>
          </div>

          {/* Hero Visual Showcase Window with REAL DASHBOARD SCREENSHOT */}
          <div className="mt-12 sm:mt-16 relative max-w-6xl mx-auto">
            <div className="relative rounded-3xl border border-slate-200/90 bg-white p-3 sm:p-5 shadow-2xl shadow-emerald-950/15 overflow-hidden group">
              {/* Web Portal Browser Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100 px-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-rose-400" />
                    <div className="w-3 h-3 rounded-full bg-amber-400" />
                    <div className="w-3 h-3 rounded-full bg-emerald-400" />
                  </div>
                  <div className="flex items-center gap-2 bg-slate-100 px-3.5 py-1 rounded-xl border border-slate-200/80 text-xs font-mono font-bold text-slate-600">
                    <Lock className="w-3.5 h-3.5 text-emerald-600" />
                    <span>app.trackpro.io/admin/dashboard</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase text-emerald-700 bg-emerald-50 px-3.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Multi-Tenant System • Operational
                  </span>
                </div>
              </div>

              {/* TrackPro Executive Analytics Dashboard Screenshot Container */}
              <div className="relative mt-3 rounded-2xl overflow-hidden border border-slate-200/80 shadow-xl bg-slate-50">
                <img
                  src="/images/dashboard-hero.png"
                  alt="TrackPro SaaS Employee Monitoring Dashboard"
                  className="w-full h-auto object-cover rounded-2xl group-hover:scale-[1.005] transition-transform duration-500"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=1200&auto=format&fit=crop';
                  }}
                />

                {/* Floating Animated Telemetry Info Pills Overlay */}
                <div className="absolute top-6 left-6 bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-2xl hidden md:flex items-center gap-3 animate-pulse">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                    <Navigation className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-emerald-600 block tracking-wider">Live GPS Telemetry</span>
                    <span className="text-xs font-bold text-slate-900">Amit Kumar • 16 Active Tracking</span>
                  </div>
                </div>

                <div className="absolute top-6 right-6 bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-2xl hidden md:flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center font-bold">
                    <ShieldCheck className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-orange-600 block tracking-wider">Geofence Attendance</span>
                    <span className="text-xs font-bold text-slate-900">42 Present Today (87.5%)</span>
                  </div>
                </div>

                <div className="absolute bottom-6 left-6 bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-2xl hidden md:flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                    <Receipt className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-amber-600 block tracking-wider">Automated Mileage Audit</span>
                    <span className="text-xs font-bold text-slate-900">Fuel Receipt • ₹1,450 Approved</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Social Proof Metric Stats Banner */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-md">
            <div className="text-center space-y-1">
              <span className="text-3xl sm:text-4xl font-black text-slate-900 block tracking-tight">10,000+</span>
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block">Happy Field Staff</span>
            </div>
            <div className="text-center space-y-1 border-l border-slate-100">
              <span className="text-3xl sm:text-4xl font-black text-orange-500 block tracking-tight">500M+</span>
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block">Telemetry Pings</span>
            </div>
            <div className="text-center space-y-1 border-l border-slate-100">
              <span className="text-3xl sm:text-4xl font-black text-emerald-600 block tracking-tight">99.99%</span>
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block">Uptime Guarantee</span>
            </div>
            <div className="text-center space-y-1 border-l border-slate-100">
              <span className="text-3xl sm:text-4xl font-black text-orange-500 block tracking-tight">24/7</span>
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block">Live Priority Support</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 3. FEATURES SECTION (VIBRANT HIGH-CONTRAST CARDS) ──────── */}
      <section id="features" className="py-20 sm:py-28 bg-[#fafdfb] relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
            <span className="text-xs font-black uppercase tracking-widest text-emerald-800 bg-emerald-100 px-4 py-1.5 rounded-full border border-emerald-200 inline-flex items-center gap-1.5 shadow-xs">
              <Zap className="w-4 h-4 text-emerald-600 fill-emerald-600" />
              <span>Why Choose TrackPro SaaS</span>
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">
              Everything You Need for <span className="text-emerald-600">Total Field Control</span>
            </h2>
            <p className="text-slate-600 text-sm sm:text-base font-semibold max-w-2xl mx-auto">
              Eliminate proxy attendance, inflated fuel claims, and unverified client meetings with our complete multi-tenant cloud telemetry suite.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: Navigation,
                title: 'Live GPS Telemetry & Route Replay',
                desc: 'Track real-time movement, battery levels, speed warnings, and review historical route replays with minute-by-minute accuracy.',
                tag: 'Real-Time Telemetry',
                badge: 'Live Map',
                iconBg: 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25',
                badgeStyle: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                tagStyle: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                hoverBorder: 'hover:border-emerald-500 hover:shadow-emerald-600/10',
              },
              {
                icon: ShieldCheck,
                title: 'Geofenced Selfie Attendance',
                desc: 'Enforce attendance check-ins inside designated office or site radiuses with mandatory selfie photo & location timestamp.',
                tag: 'Zero Proxy Attendance',
                badge: 'Geofence Active',
                iconBg: 'bg-orange-500 text-white shadow-lg shadow-orange-500/25',
                badgeStyle: 'bg-orange-50 text-orange-700 border-orange-200',
                tagStyle: 'bg-orange-50 text-orange-800 border-orange-200',
                hoverBorder: 'hover:border-orange-500 hover:shadow-orange-500/10',
              },
              {
                icon: Receipt,
                title: 'Automated Mileage & Receipt Audit',
                desc: 'Calculates exact fuel expenses per km (Bike/Car) + OCR receipt scanning for instant manager approvals.',
                tag: 'Instant Expense Audit',
                badge: 'OCR Scan',
                iconBg: 'bg-amber-500 text-white shadow-lg shadow-amber-500/25',
                badgeStyle: 'bg-amber-50 text-amber-800 border-amber-200',
                tagStyle: 'bg-amber-50 text-amber-800 border-amber-200',
                hoverBorder: 'hover:border-amber-500 hover:shadow-amber-500/10',
              },
              {
                icon: Briefcase,
                title: 'Client Visit & Signature Log',
                desc: 'Log client meetings with location coordinates, mobile numbers, deal amounts, and digital client signatures.',
                tag: 'Verified Client Meetings',
                badge: 'CRM Integrated',
                iconBg: 'bg-teal-600 text-white shadow-lg shadow-teal-600/25',
                badgeStyle: 'bg-teal-50 text-teal-800 border-teal-200',
                tagStyle: 'bg-teal-50 text-teal-800 border-teal-200',
                hoverBorder: 'hover:border-teal-500 hover:shadow-teal-600/10',
              },
              {
                icon: CheckCircle2,
                title: 'Task & Territory Management',
                desc: 'Assign daily tasks, track completion progress, manage leads, and optimize team routes efficiently.',
                tag: 'Workflow Automation',
                badge: 'High Productivity',
                iconBg: 'bg-orange-600 text-white shadow-lg shadow-orange-600/25',
                badgeStyle: 'bg-orange-50 text-orange-800 border-orange-200',
                tagStyle: 'bg-orange-50 text-orange-800 border-orange-200',
                hoverBorder: 'hover:border-orange-500 hover:shadow-orange-600/10',
              },
              {
                icon: TrendingUp,
                title: 'Consolidated Executive Analytics',
                desc: 'Generate automated PDF & Excel reports for payroll, HR attendance logs, and manager telemetry audits.',
                tag: 'Executive Insights',
                badge: 'Export PDF/Excel',
                iconBg: 'bg-emerald-700 text-white shadow-lg shadow-emerald-700/25',
                badgeStyle: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                tagStyle: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                hoverBorder: 'hover:border-emerald-600 hover:shadow-emerald-700/10',
              },
            ].map((f, i) => {
              const Icon = f.icon;
              return (
                <div
                  key={i}
                  className={`p-8 rounded-3xl bg-white border border-slate-200/90 shadow-md ${f.hoverBorder} hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-300 group flex flex-col justify-between`}
                >
                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <div className={`w-14 h-14 rounded-2xl ${f.iconBg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                        <Icon className="w-7 h-7 stroke-[2.2]" />
                      </div>
                      <span className={`text-[10px] font-black uppercase tracking-wider ${f.badgeStyle} px-3 py-1 rounded-full border shadow-2xs`}>
                        {f.badge}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-xl font-black text-slate-900 group-hover:text-emerald-700 transition-colors leading-snug">
                        {f.title}
                      </h3>
                      <p className="text-slate-600 text-xs sm:text-sm font-semibold leading-relaxed">
                        {f.desc}
                      </p>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-100 flex items-center justify-between mt-6">
                    <span className={`text-[11px] font-extrabold uppercase tracking-wide px-3 py-1 rounded-xl border ${f.tagStyle}`}>
                      {f.tag}
                    </span>
                    <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 group-hover:bg-emerald-600 group-hover:text-white flex items-center justify-center transition-colors shadow-2xs">
                      <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── 4. HOW IT WORKS SECTION (CONNECTED 4-STEP WORKFLOW) ─────────────────────────── */}
      <section id="how-it-works" className="py-20 sm:py-28 bg-slate-50 border-y border-slate-200/80 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
            <span className="text-xs font-black uppercase tracking-widest text-emerald-800 bg-emerald-100 px-4 py-1.5 rounded-full border border-emerald-300 inline-flex items-center gap-2 shadow-xs">
              <Zap className="w-4 h-4 text-emerald-600 fill-emerald-600" />
              <span>Get Started in 4 Easy Steps</span>
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">
              Simple 4-Step Onboarding Process
            </h2>
            <p className="text-slate-600 text-sm sm:text-base font-semibold max-w-2xl mx-auto">
              Launch your multi-tenant organization portal in minutes. No complex software installations required.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
            {[
              {
                step: 'STEP 01',
                title: 'Register Organization',
                desc: 'Create your company account in 60 seconds. Set shift timings, logo, and shift grace periods.',
                icon: Building2,
                iconBg: 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25',
                badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
              },
              {
                step: 'STEP 02',
                title: 'Add Field Executives',
                desc: 'Invite your field staff and managers via SMS, WhatsApp link, or instant CSV upload.',
                icon: Users,
                iconBg: 'bg-orange-500 text-white shadow-lg shadow-orange-500/25',
                badgeBg: 'bg-orange-50 text-orange-800 border-orange-200',
              },
              {
                step: 'STEP 03',
                title: 'Set Geofence & Fuel Rates',
                desc: 'Define office location perimeters, selfie requirements, and fuel km reimbursement rates.',
                icon: ShieldCheck,
                iconBg: 'bg-amber-500 text-white shadow-lg shadow-amber-500/25',
                badgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
              },
              {
                step: 'STEP 04',
                title: 'Monitor Live Telemetry',
                desc: 'Track real-time movement, review visit reports, and approve expenses seamlessly.',
                icon: Navigation,
                iconBg: 'bg-teal-600 text-white shadow-lg shadow-teal-600/25',
                badgeBg: 'bg-teal-50 text-teal-800 border-teal-200',
              },
            ].map((s, idx) => {
              const Icon = s.icon;
              return (
                <div
                  key={idx}
                  className="bg-white p-8 rounded-3xl border border-slate-200/90 shadow-lg hover:shadow-2xl hover:border-emerald-400 hover:-translate-y-1.5 transition-all duration-300 relative space-y-5 flex flex-col justify-between group"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className={`w-14 h-14 rounded-2xl ${s.iconBg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                        <Icon className="w-7 h-7 stroke-[2.2]" />
                      </div>
                      <span className={`text-[11px] font-mono font-black uppercase tracking-wider ${s.badgeBg} px-3 py-1 rounded-full border shadow-2xs`}>
                        {s.step}
                      </span>
                    </div>

                    <h3 className="text-xl font-black text-slate-900 group-hover:text-emerald-700 transition-colors leading-snug">
                      {s.title}
                    </h3>
                    <p className="text-slate-600 text-xs sm:text-sm font-semibold leading-relaxed">
                      {s.desc}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-400">
                    <span>Process Step {idx + 1} of 4</span>
                    {idx < 3 ? (
                      <ArrowRight className="w-4 h-4 text-emerald-600 group-hover:translate-x-1 transition-transform" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── 5. TAILORED SOLUTIONS (INTERACTIVE TABS) ───────────────────────── */}
      <section id="solutions" className="py-20 sm:py-28 bg-white relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
            <span className="text-xs font-black uppercase tracking-widest text-orange-800 bg-orange-100 px-3.5 py-1 rounded-full border border-orange-300 inline-flex items-center gap-2">
              <Layers className="w-4 h-4 text-orange-600" />
              <span>Tailored Industry Scenarios</span>
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Tailored Solutions for Every Field Business
            </h2>
            <p className="text-slate-600 text-sm sm:text-base font-semibold">
              See how TrackPro optimizes field operations for your specific industry requirements.
            </p>
          </div>

          {/* Industry Tab Navigation */}
          <div className="flex items-center justify-center gap-3 overflow-x-auto pb-4">
            {industries.map((ind) => {
              const TabIcon = ind.icon;
              return (
                <button
                  key={ind.id}
                  onClick={() => setActiveTab(ind.id)}
                  className={`px-5 py-3.5 rounded-2xl text-xs font-extrabold transition-all whitespace-nowrap flex items-center gap-2 ${
                    activeTab === ind.id
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25 scale-105'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <TabIcon className="w-4 h-4 stroke-[2.2]" />
                  <span>{ind.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Content Display */}
          {industries.map((ind) => {
            if (ind.id !== activeTab) return null;
            return (
              <div
                key={ind.id}
                className="mt-8 bg-gradient-to-br from-emerald-50/80 via-white to-orange-50/60 text-slate-900 rounded-3xl p-6 sm:p-10 border border-slate-200/90 shadow-xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center animate-in fade-in duration-300"
              >
                {/* Left Column: Process & Capabilities */}
                <div className="lg:col-span-7 space-y-6">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-widest bg-orange-100 text-orange-700 border border-orange-200 px-3.5 py-1 rounded-full inline-block">
                      {ind.badge}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                      Verified Workflow
                    </span>
                  </div>

                  <h3 className="text-2xl sm:text-3xl font-black leading-tight text-slate-900">
                    {ind.title}
                  </h3>
                  <p className="text-slate-600 text-sm font-semibold leading-relaxed">
                    {ind.desc}
                  </p>

                  {/* 3-Step Process Flow */}
                  <div className="space-y-2 pt-1">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5 block">
                      <Zap className="w-3.5 h-3.5 text-orange-500 fill-orange-500 inline" />
                      <span>Automated Industry Process:</span>
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {ind.process.map((proc, pIdx) => (
                        <div key={pIdx} className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs space-y-1">
                          <span className="text-[10px] font-mono font-bold text-orange-600 block">Step 0{pIdx + 1}</span>
                          <span className="text-xs font-bold text-slate-900 block leading-tight">{proc}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 4 KPI Highlights */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    {ind.kpis.map((kpi, kIdx) => (
                      <div key={kIdx} className="flex items-center gap-2.5 text-xs font-bold text-slate-800 bg-white/90 p-3 rounded-xl border border-slate-200/70 shadow-2xs">
                        <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                        <span>{kpi}</span>
                      </div>
                    ))}
                  </div>

                  {/* Action CTA */}
                  <div className="pt-2">
                    <Link
                      to="/register-organization"
                      className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-lg shadow-emerald-600/25 transition active:scale-95"
                    >
                      <span>Deploy {ind.label} Automation</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>

                {/* Right Column: Custom Vector UI Application Card */}
                <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xl space-y-4">
                  <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
                    <div>
                      <h4 className="text-xs font-black text-slate-900">{ind.cardTitle}</h4>
                      <p className="text-[10px] font-semibold text-slate-500">{ind.cardSub}</p>
                    </div>
                    <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Live GPS
                    </span>
                  </div>

                  {ind.mockupType === 'sales' && (
                    <div className="space-y-3 text-xs font-semibold">
                      <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200/80 space-y-1">
                        <div className="flex justify-between font-extrabold text-slate-900">
                          <span>Apollo Healthcare Ltd</span>
                          <span className="text-emerald-700 font-black">₹1,25,000</span>
                        </div>
                        <p className="text-[11px] text-slate-600">Check-in: 10:15 AM (Geofence Verified)</p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-[11px]">
                        <span className="text-slate-600 font-bold">Client Signature Status</span>
                        <span className="font-black text-emerald-600 bg-white px-2.5 py-0.5 rounded-md border border-emerald-200">Verified ✓</span>
                      </div>
                    </div>
                  )}

                  {ind.mockupType === 'fmcg' && (
                    <div className="space-y-3 text-xs font-semibold">
                      <div className="p-3.5 rounded-xl bg-orange-50/80 border border-orange-200/80 space-y-1">
                        <div className="flex justify-between font-extrabold text-slate-900">
                          <span>Metro Supermarket #402</span>
                          <span className="text-orange-600 font-black">₹45,500</span>
                        </div>
                        <p className="text-[11px] text-slate-600">Order: 18 SKUs Booked • Stock Audit OK</p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-[11px]">
                        <span className="text-slate-600 font-bold">Today's Store Visits</span>
                        <span className="font-black text-orange-600 bg-white px-2.5 py-0.5 rounded-md border border-orange-200">12 / 12 Complete</span>
                      </div>
                    </div>
                  )}

                  {ind.mockupType === 'service' && (
                    <div className="space-y-3 text-xs font-semibold">
                      <div className="p-3.5 rounded-xl bg-blue-50/80 border border-blue-200/80 space-y-1">
                        <div className="flex justify-between font-extrabold text-slate-900">
                          <span>Ticket #9081 Repair</span>
                          <span className="text-blue-700 font-black">On-Time Arrival</span>
                        </div>
                        <p className="text-[11px] text-slate-600">HVAC Control Board • Geo Arrival 11:30 AM</p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-[11px]">
                        <span className="text-slate-600 font-bold">Engineer Selfie Punch</span>
                        <span className="font-black text-blue-600 bg-white px-2.5 py-0.5 rounded-md border border-blue-200">Verified ✓</span>
                      </div>
                    </div>
                  )}

                  {ind.mockupType === 'logistics' && (
                    <div className="space-y-3 text-xs font-semibold">
                      <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200/80 space-y-1">
                        <div className="flex justify-between font-extrabold text-slate-900">
                          <span>Rider #14 Telemetry</span>
                          <span className="text-emerald-700 font-black">18.4 km Covered</span>
                        </div>
                        <p className="text-[11px] text-slate-600">Speed: 24 km/h • Fuel Claim: ₹1,450 Approved</p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-[11px]">
                        <span className="text-slate-600 font-bold">Speed Violation Warning</span>
                        <span className="font-black text-emerald-600 bg-white px-2.5 py-0.5 rounded-md border border-emerald-200">0 Alerts (Safe)</span>
                      </div>
                    </div>
                  )}

                  {ind.mockupType === 'construction' && (
                    <div className="space-y-3 text-xs font-semibold">
                      <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200/80 space-y-1">
                        <div className="flex justify-between font-extrabold text-slate-900">
                          <span>Site #4 Delhi Perimeter</span>
                          <span className="text-amber-700 font-black">150m Geofence</span>
                        </div>
                        <p className="text-[11px] text-slate-600">Contractor Attendance: 42 Present Today</p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-[11px]">
                        <span className="text-slate-600 font-bold">Off-Site Punch Block</span>
                        <span className="font-black text-emerald-600 bg-white px-2.5 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Active
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="pt-2 text-center">
                    <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                      🔒 Verified Multi-Tenant Enterprise Data
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── 6. PRICING PLAN SECTION (HIGH-IMPACT ELEVATED TIERS) ──────────────────────── */}
      <section id="pricing" className="py-20 sm:py-28 bg-gradient-to-b from-slate-50 via-[#fafdfb] to-white border-t border-slate-200/80 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <span className="text-xs font-black uppercase tracking-widest text-emerald-800 bg-emerald-100 px-4 py-1.5 rounded-full border border-emerald-300 inline-flex items-center gap-1.5 shadow-xs">
              <Receipt className="w-4 h-4 text-emerald-600" />
              <span>Simple & Transparent Pricing</span>
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">
              Predictable Plans Built to <span className="text-orange-500">Scale With You</span>
            </h2>
            <p className="text-slate-600 text-sm sm:text-base font-semibold max-w-2xl mx-auto">
              Start with a 14-day free trial. Upgrade or cancel anytime with zero lock-in contracts.
            </p>

            {/* Monthly / Yearly Toggle Switcher */}
            <div className="inline-flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-md mt-4">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all ${
                  billingCycle === 'monthly'
                    ? 'bg-emerald-600 text-white shadow-sm scale-105'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Monthly Billing
              </button>
              <button
                onClick={() => setBillingCycle('yearly')}
                className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                  billingCycle === 'yearly'
                    ? 'bg-orange-500 text-white shadow-sm scale-105'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Yearly Billing</span>
                <span className="text-[10px] bg-amber-300 text-slate-900 px-2.5 py-0.5 rounded-full font-black shadow-2xs">
                  SAVE 20% OFF
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch pt-4">
            {/* Starter Plan */}
            <div className="bg-white rounded-3xl p-8 sm:p-9 border border-slate-200/90 shadow-xl hover:border-slate-300 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between space-y-8 relative group">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center shadow-xs">
                    <Users className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700 bg-slate-100 px-3.5 py-1 rounded-full border border-slate-200">
                    Starter Plan
                  </span>
                </div>

                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-5xl font-black text-slate-900 tracking-tight">
                      {billingCycle === 'yearly' ? '₹399' : '₹499'}
                    </span>
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">/ member / mo</span>
                  </div>
                  <p className="text-xs font-semibold text-slate-500 mt-2">Essential telemetry for small field teams up to 10 staff.</p>
                </div>

                <div className="space-y-3.5 pt-6 border-t border-slate-100 text-xs font-bold text-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                    <span>Up to 10 Field Executives</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                    <span>Live GPS Telemetry & Replay</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                    <span>Geofenced Selfie Attendance</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                    <span>Basic KM Mileage Calculation</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-400">
                    <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center flex-shrink-0">
                      <X className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                    <span className="line-through">Advanced Receipt OCR Audit</span>
                  </div>
                </div>
              </div>

              <Link
                to="/register-organization"
                className="w-full text-center py-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs shadow-lg transition active:scale-95 flex items-center justify-center gap-2"
              >
                <span>Choose Starter Plan</span>
                <ArrowRight className="w-4 h-4 text-slate-300" />
              </Link>
            </div>

            {/* Pro Plan (MOST POPULAR - FEATURED ELEVATED CARD) */}
            <div className="bg-gradient-to-b from-orange-50/60 via-white to-orange-50/30 rounded-3xl p-8 sm:p-9 border-2 border-orange-500 shadow-2xl shadow-orange-500/20 flex flex-col justify-between space-y-8 relative transform lg:-translate-y-3 z-10">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-orange-500 text-white font-black text-[11px] uppercase tracking-widest px-5 py-1.5 rounded-full shadow-lg shadow-orange-500/30 border border-orange-400 flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 fill-white text-white" />
                <span>MOST POPULAR • 14-DAY TRIAL</span>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between pt-2">
                  <div className="w-12 h-12 rounded-2xl bg-orange-500 text-white flex items-center justify-center shadow-md shadow-orange-500/30">
                    <Zap className="w-6 h-6 fill-white" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-wider text-orange-800 bg-orange-100 px-3.5 py-1 rounded-full border border-orange-200">
                    Growth Pro Plan
                  </span>
                </div>

                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-5xl font-black text-slate-900 tracking-tight">
                      {billingCycle === 'yearly' ? '₹799' : '₹999'}
                    </span>
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">/ member / mo</span>
                  </div>
                  <p className="text-xs font-semibold text-slate-600 mt-2">Full multi-tenant feature suite for scaling teams up to 50 staff.</p>
                </div>

                <div className="space-y-3.5 pt-6 border-t border-orange-100 text-xs font-bold text-slate-900">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                    <span>Up to 50 Field Executives</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                    <span>1-Sec Telemetry & Stationary Alerts</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                    <span>Geofence & Shift Grace Control</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                    <span>Receipt OCR + Fuel KM Rate Audit</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                    <span>Client Signature & Meeting Log</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                    <span>Executive PDF & Excel Reports</span>
                  </div>
                </div>
              </div>

              <Link
                to="/register-organization"
                className="w-full text-center py-4 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-black text-xs shadow-xl shadow-orange-500/30 transition active:scale-95 flex items-center justify-center gap-2"
              >
                <span>Start 14-Day Free Pro Trial</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Enterprise Plan */}
            <div className="bg-white rounded-3xl p-8 sm:p-9 border border-slate-200/90 shadow-xl hover:border-emerald-300 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between space-y-8 relative group">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/30">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-800 bg-emerald-100 px-3.5 py-1 rounded-full border border-emerald-200">
                    Enterprise Plan
                  </span>
                </div>

                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-5xl font-black text-slate-900 tracking-tight">
                      {billingCycle === 'yearly' ? '₹1,999' : '₹2,499'}
                    </span>
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">/ member / mo</span>
                  </div>
                  <p className="text-xs font-semibold text-slate-500 mt-2">Dedicated cloud infrastructure & REST API for 50+ field staff.</p>
                </div>

                <div className="space-y-3.5 pt-6 border-t border-slate-100 text-xs font-bold text-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                    <span>Unlimited Field Executives</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                    <span>Dedicated Cloud Tenant Instance</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                    <span>REST API & Webhooks Integration</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                    <span>Meta WhatsApp Cloud API Integration</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                    <span>Dedicated Account Manager & SLA</span>
                  </div>
                </div>
              </div>

              <Link
                to="/register-organization"
                className="w-full text-center py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-xl shadow-emerald-600/25 transition active:scale-95 flex items-center justify-center gap-2"
              >
                <span>Contact Enterprise Sales</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 7. TESTIMONIALS / CLIENT REVIEWS SECTION ──────────────────────── */}
      <section id="testimonials" className="py-20 sm:py-28 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-black tracking-wide shadow-2xs">
              <Award className="w-4 h-4 text-emerald-600" />
              <span>Social Proof & Client Reviews</span>
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">
              Trusted by 500+ Operations Leaders Across India
            </h2>

            <p className="text-slate-600 text-sm sm:text-base font-semibold">
              See why enterprise field teams and operations heads rely on TrackPro SaaS for daily telemetry, attendance & expense audits.
            </p>

            <div className="pt-2 flex flex-wrap items-center justify-center gap-4">
              <div className="inline-flex items-center gap-3 bg-white px-5 py-2.5 rounded-full border border-slate-200 shadow-md">
                <div className="flex items-center gap-1 text-amber-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <span className="text-xs font-black text-slate-900">Rated 4.9/5.0 by 1,200+ Operations Managers</span>
              </div>

              <div className="inline-flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-full border border-slate-200/80 text-xs font-bold text-slate-700">
                <div className="flex -space-x-2">
                  <img className="w-6 h-6 rounded-full border-2 border-white object-cover" src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop" alt="User" />
                  <img className="w-6 h-6 rounded-full border-2 border-white object-cover" src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop" alt="User" />
                  <img className="w-6 h-6 rounded-full border-2 border-white object-cover" src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=200&auto=format&fit=crop" alt="User" />
                </div>
                <span>Joined by 100+ Enterprise Brands</span>
              </div>
            </div>
          </div>

          {/* Client Brand Logo Ticker (LUCIDE SVG ICONS ONLY - NO EMOJIS) */}
          <div className="bg-slate-50/80 py-6 px-6 rounded-3xl border border-slate-200/80 flex flex-wrap items-center justify-around gap-6 shadow-2xs">
            <span className="text-xs font-black uppercase text-slate-400 tracking-widest">Enterprise Clients:</span>
            <span className="text-sm font-black text-slate-800 tracking-tight flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-600" /> Apollo Healthcare
            </span>
            <span className="text-sm font-black text-slate-800 tracking-tight flex items-center gap-2">
              <Navigation className="w-4 h-4 text-orange-500" /> Swift Cargo Logistics
            </span>
            <span className="text-sm font-black text-slate-800 tracking-tight flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-emerald-600" /> Horizon Retail Beat
            </span>
            <span className="text-sm font-black text-slate-800 tracking-tight flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" /> CivTech Infrastructure
            </span>
            <span className="text-sm font-black text-slate-800 tracking-tight flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500 fill-amber-500" /> EnergyTech Field Care
            </span>
          </div>

          {/* Testimonials Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
            {/* Card 1 */}
            <div className="bg-slate-50/80 rounded-3xl border border-slate-200/90 overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 flex flex-col justify-between group">
              <div className="relative h-48 overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=600&auto=format&fit=crop"
                  alt="Rakesh Kumar"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent" />
                <div className="absolute bottom-3 left-4 text-white">
                  <span className="text-xs font-black block">Rakesh Kumar</span>
                  <span className="text-[10px] text-slate-200 font-semibold">Head of Field Operations, Apollo Care</span>
                </div>
              </div>

              <div className="p-7 space-y-4 flex-1 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-amber-400">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                      Verified Customer ✓
                    </span>
                  </div>
                  <p className="text-slate-700 text-xs sm:text-sm font-semibold leading-relaxed italic">
                    "TrackPro transformed our B2B field sales operations. We eliminated fake location claims completely and reduced travel expense audit processing time from 7 days to 5 minutes!"
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-200/80 flex items-center justify-between text-[11px] font-bold text-slate-500">
                  <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-emerald-600" /> Punjab, India</span>
                  <span className="text-emerald-600 font-black">Field Telemetry Suite</span>
                </div>
              </div>
            </div>

            {/* Card 2 */}
            <div className="bg-emerald-600 text-white rounded-3xl p-8 shadow-xl flex flex-col justify-between space-y-6 relative overflow-hidden group">
              <div className="space-y-4 relative z-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-amber-300">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-300 text-amber-300" />
                    ))}
                  </div>
                  <span className="text-[10px] font-black uppercase text-slate-900 bg-amber-300 px-2.5 py-0.5 rounded-full">
                    Featured Review
                  </span>
                </div>

                <p className="text-emerald-50 text-sm sm:text-base font-bold leading-relaxed italic">
                  "The automated mileage calculation based on bike km rates saved our logistics company over ₹2.4 Lakhs in the first quarter alone. Essential software for field fleets!"
                </p>
              </div>

              <div className="pt-6 border-t border-emerald-500/80 flex items-center gap-3.5 relative z-10">
                <img
                  src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=200&auto=format&fit=crop"
                  alt="Priya Sharma"
                  className="w-12 h-12 rounded-2xl object-cover border-2 border-white/40 shadow-sm"
                />
                <div>
                  <h4 className="text-sm font-black text-white">Priya Sharma</h4>
                  <p className="text-[11px] text-emerald-100 font-semibold">Logistics Director, Swift Cargo • Delhi NCR</p>
                </div>
              </div>
            </div>

            {/* Card 3 */}
            <div className="bg-slate-50/80 rounded-3xl border border-slate-200/90 overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 flex flex-col justify-between group">
              <div className="relative h-48 overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?q=80&w=600&auto=format&fit=crop"
                  alt="Amit Verma"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent" />
                <div className="absolute bottom-3 left-4 text-white">
                  <span className="text-xs font-black block">Amit Verma</span>
                  <span className="text-[10px] text-slate-200 font-semibold">Managing Director, Horizon Retail</span>
                </div>
              </div>

              <div className="p-7 space-y-4 flex-1 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-amber-400">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    <span className="text-[10px] font-black uppercase text-orange-700 bg-orange-100 px-2.5 py-0.5 rounded-full">
                      Verified Customer ✓
                    </span>
                  </div>
                  <p className="text-slate-700 text-xs sm:text-sm font-semibold leading-relaxed italic">
                    "Geofenced selfie attendance combined with digital client signatures gave our executive team complete peace of mind. Highly recommended multi-tenant SaaS platform."
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-200/80 flex items-center justify-between text-[11px] font-bold text-slate-500">
                  <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-orange-500" /> Mumbai, India</span>
                  <span className="text-orange-600 font-black">Retail CRM Suite</span>
                </div>
              </div>
            </div>
          </div>

          {/* Social Proof & Trust Metric Widgets */}
          <div className="pt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                <Star className="w-6 h-6 text-amber-500 fill-amber-500" />
              </div>
              <div>
                <span className="text-sm font-black text-slate-900 block">4.9 / 5.0 Rating</span>
                <span className="text-xs font-semibold text-slate-500 block">1,200+ Verified Reviews</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <ShieldCheck className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <span className="text-sm font-black text-slate-900 block">ISO 27001 Certified</span>
                <span className="text-xs font-semibold text-slate-500 block">Bank-Grade Encryption</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                <Activity className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <span className="text-sm font-black text-slate-900 block">99.99% Uptime SLA</span>
                <span className="text-xs font-semibold text-slate-500 block">Real-Time Telemetry Sync</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-700 flex items-center justify-center font-bold">
                <Building2 className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <span className="text-sm font-black text-slate-900 block">500+ SaaS Tenants</span>
                <span className="text-xs font-semibold text-slate-500 block">Active Multi-Organizations</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 8. FAQ ACCORDION (REDESIGNED WITH HIGH-CONTRAST BRAND CARDS) ────────────────── */}
      <section id="faq" className="py-20 sm:py-28 bg-gradient-to-b from-white via-slate-50/80 to-emerald-50/30 border-t border-slate-200/80 relative">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-3 mb-16">
            <span className="text-xs font-black uppercase tracking-widest text-emerald-800 bg-emerald-100 px-4 py-1.5 rounded-full border border-emerald-300 inline-flex items-center gap-1.5 shadow-xs">
              <HelpCircle className="w-4 h-4 text-emerald-600" />
              <span>Got Questions?</span>
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">
              Frequently Asked <span className="text-emerald-600">Questions</span>
            </h2>
            <p className="text-slate-600 text-sm sm:text-base font-semibold max-w-2xl mx-auto">
              Find answers to common questions regarding telemetry accuracy, battery consumption, and SaaS security.
            </p>
          </div>

          <div className="space-y-4">
            {[
              {
                q: 'How does live location tracking affect field employees’ mobile battery?',
                a: 'TrackPro uses intelligent adaptive polling algorithms. When the employee is stationary, GPS polling automatically slows down to consume less than 3% battery per full 9-hour work shift.',
              },
              {
                q: 'Can employees punch in from outside their assigned office or site radius?',
                a: 'If strict geofencing is enabled by your Organization Admin, the app will block attendance punch-ins if the employee is outside the designated radius (e.g., 150 meters).',
              },
              {
                q: 'How does the automated expense mileage audit work?',
                a: 'TrackPro calculates the exact distance traveled via Haversine GPS telemetry during active shifts, then automatically multiplies the km count by your organization’s set rate (e.g. ₹3.50/km for Bike, ₹8.00/km for Car).',
              },
              {
                q: 'Can we upload our own organization logo and brand identity?',
                a: 'Yes! Organization Admins can upload custom logos in Organization Settings, which will appear on mobile sidebar headers, email notices, and PDF export reports.',
              },
              {
                q: 'What happens after our 14-day free trial ends?',
                a: 'You can upgrade your subscription seamlessly via monthly or annual billing. All your data, employee records, and route histories remain intact.',
              },
            ].map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div
                  key={index}
                  className={`rounded-2xl transition-all duration-300 overflow-hidden group ${
                    isOpen
                      ? 'bg-white border-2 border-emerald-500 shadow-xl shadow-emerald-500/10 scale-[1.01]'
                      : 'bg-white border border-slate-200/90 shadow-sm hover:border-emerald-300 hover:shadow-lg'
                  }`}
                >
                  <button
                    onClick={() => toggleFaq(index)}
                    className="w-full p-6 text-left flex items-center justify-between gap-4 focus:outline-none"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-10 h-10 rounded-xl font-black text-xs flex items-center justify-center transition-colors flex-shrink-0 ${
                          isOpen
                            ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
                            : 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20 group-hover:scale-105'
                        }`}
                      >
                        Q{index + 1}
                      </div>
                      <span
                        className={`text-base sm:text-lg font-black transition-colors ${
                          isOpen ? 'text-emerald-700' : 'text-slate-900 group-hover:text-emerald-600'
                        }`}
                      >
                        {faq.q}
                      </span>
                    </div>
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                        isOpen
                          ? 'bg-orange-500 text-white rotate-180 shadow-md shadow-orange-500/30'
                          : 'bg-slate-100 text-slate-600 group-hover:bg-emerald-600 group-hover:text-white'
                      }`}
                    >
                      <ChevronDown className="w-5 h-5 stroke-[2.5]" />
                    </div>
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-6 pt-3 border-t border-emerald-100 bg-gradient-to-r from-emerald-50/50 via-white to-orange-50/30">
                      <div className="border-l-4 border-emerald-500 pl-4 py-1 text-slate-700 text-xs sm:text-sm font-semibold leading-relaxed">
                        {faq.a}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── 9. INTEGRATIONS & TECHNOLOGY ECOSYSTEM ─────────────────────────── */}
      <section className="py-20 bg-white border-t border-slate-200/80 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          <div className="space-y-2">
            <span className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center justify-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-slate-400 fill-slate-400" />
              <span>Enterprise Technology Ecosystem</span>
            </span>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">
              Works Seamlessly With Your Existing Software Stack
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex items-center justify-center gap-3 hover:border-emerald-300 hover:bg-white transition-all shadow-2xs">
              <Globe className="w-5 h-5 text-emerald-600" />
              <span className="text-xs font-extrabold text-slate-800">Google Maps API</span>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex items-center justify-center gap-3 hover:border-emerald-300 hover:bg-white transition-all shadow-2xs">
              <MessageSquare className="w-5 h-5 text-emerald-600" />
              <span className="text-xs font-extrabold text-slate-800">Meta WhatsApp API</span>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex items-center justify-center gap-3 hover:border-blue-300 hover:bg-white transition-all shadow-2xs">
              <Database className="w-5 h-5 text-blue-600" />
              <span className="text-xs font-extrabold text-slate-800">Tally ERP Sync</span>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex items-center justify-center gap-3 hover:border-purple-300 hover:bg-white transition-all shadow-2xs">
              <Cpu className="w-5 h-5 text-purple-600" />
              <span className="text-xs font-extrabold text-slate-800">WebSockets Real-Time</span>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex items-center justify-center gap-3 hover:border-orange-300 hover:bg-white transition-all shadow-2xs">
              <Layers className="w-5 h-5 text-orange-500" />
              <span className="text-xs font-extrabold text-slate-800">REST Developer API</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 9.5. VIDEO DEMO SHOWCASE SECTION (EXPANDED WIDE FORMAT, NO OUTER BOX LAYER, ALWAYS MUTED) ─── */}
      <section id="video-demo" className="py-20 sm:py-28 bg-gradient-to-b from-white via-emerald-50/20 to-slate-50 relative overflow-hidden border-t border-slate-200/80">
        {/* Ambient Soft Radial Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[600px] bg-gradient-to-r from-emerald-300/15 via-orange-200/15 to-teal-300/15 blur-[160px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-10">
          {/* TOP TEXT: Section Header & Explanatory Text */}
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="text-xs font-black uppercase tracking-widest text-emerald-800 bg-emerald-100 px-4 py-1.5 rounded-full border border-emerald-300 inline-flex items-center gap-2 shadow-xs">
              <Play className="w-4 h-4 text-emerald-600 fill-emerald-600" />
              <span>Interactive Platform Showcase</span>
            </span>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight">
              Watch <span className="text-emerald-600">TrackPro SaaS</span> in Action
            </h2>

            <p className="text-slate-600 text-sm sm:text-base font-semibold leading-relaxed max-w-2xl mx-auto">
              Take a full video walkthrough of our enterprise field monitoring ecosystem. Experience real-time GPS telemetry, geofenced selfie punch-ins, and automated mileage audits in motion.
            </p>

            {/* Quick Feature Badges Bar */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-slate-700 text-xs font-bold shadow-2xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Live GPS Map Telemetry
              </span>
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-slate-700 text-xs font-bold shadow-2xs">
                <CheckCircle2 className="w-4 h-4 text-orange-500" /> Geofence Selfie Attendance
              </span>
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-slate-700 text-xs font-bold shadow-2xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Instant Haversine Mileage
              </span>
            </div>
          </div>

          {/* BOTTOM VIDEO: WIDE FULL-WIDTH VIDEO (OUTER BOX LAYER REMOVED) */}
          <div className="w-full max-w-6xl mx-auto relative">
            <div className="relative rounded-3xl overflow-hidden border border-slate-200/90 shadow-2xl bg-slate-950 aspect-video group">
              <video
                ref={(el) => {
                  if (el) el.muted = true;
                }}
                src="/LANDINGpage.mp4"
                controls
                autoPlay
                loop
                muted
                defaultMuted
                playsInline
                className="w-full h-full object-cover rounded-3xl"
              />
            </div>

            {/* Sub-caption bar below video */}
            <div className="pt-4 px-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-bold text-slate-600">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Verified 100% Real Dashboard & Mobile Application Recording</span>
              </div>
              <Link
                to="/register-organization"
                className="text-emerald-700 font-black hover:text-emerald-800 transition-colors flex items-center gap-1.5"
              >
                <span>Start Free 14-Day Trial Now</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 10. FINAL CONVERSION PRE-FOOTER CTA (VIBRANT EMERALD LIGHT THEME - NO BLACK) ─── */}
      <section className="py-16 sm:py-24 bg-[#fafdfb] relative px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto bg-emerald-600 text-white rounded-3xl sm:rounded-[2.5rem] p-10 sm:p-16 shadow-2xl shadow-emerald-600/25 relative overflow-hidden text-center space-y-6 border border-emerald-500">
          {/* Soft Background Lighting */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-gradient-to-b from-white/20 via-orange-300/10 to-transparent blur-[100px] rounded-full pointer-events-none" />

          <div className="relative z-10 space-y-6">
            <span className="px-4 py-1.5 rounded-full bg-white/15 text-white text-xs font-black uppercase tracking-wider border border-white/30 inline-flex items-center gap-1.5 shadow-2xs">
              <Zap className="w-3.5 h-3.5 text-white fill-white" />
              <span>Enterprise Field Telemetry Platform</span>
            </span>

            <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight max-w-3xl mx-auto text-white">
              Ready to Supercharge Your Field Force Operations?
            </h2>

            <p className="text-emerald-100 text-sm sm:text-base max-w-2xl mx-auto font-semibold leading-relaxed">
              Join 500+ enterprises across India. Get instant real-time telemetry, geofenced selfie attendance, and automated expense audits in minutes.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link
                to="/register-organization"
                className="w-full sm:w-auto px-9 py-4 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-black text-base shadow-xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2.5"
              >
                <span>Create Organization Account</span>
                <ArrowRight className="w-5 h-5 text-emerald-600" />
              </Link>
              <Link
                to="/login"
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-emerald-700/80 hover:bg-emerald-700 text-white font-bold text-base border border-emerald-400/50 transition-all hover:scale-105"
              >
                Sign In to Portal
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 11. FOOTER (CRISP LIGHT THEME - NO BLACK) ────────────── */}
      <footer className="bg-slate-50 text-slate-600 py-16 border-t border-slate-200/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
            {/* Column 1: Brand */}
            <div className="md:col-span-2 space-y-4">
              <div className="flex items-center gap-3.5">
                <div className="h-10 px-2 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-xs overflow-hidden">
                  <img
                    src="/images/superCompanyLOGO.png"
                    alt="TrackPro Logo"
                    className="h-7 w-auto object-contain"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                  <div className="hidden w-full h-full bg-emerald-600 rounded-xl items-center justify-center text-white">
                    <MapPin className="w-5 h-5 stroke-white" />
                  </div>
                </div>
                <div>
                  <span className="text-2xl font-black text-slate-900 block leading-none tracking-tight">TrackPro SaaS</span>
                  <span className="text-[11px] font-black uppercase text-emerald-600 tracking-wider">Field Telemetry & CRM</span>
                </div>
              </div>
              <p className="text-xs text-slate-600 max-w-sm leading-relaxed font-semibold">
                The ultimate multi-tenant field force monitoring and CRM platform. Automate telemetry, attendance, mileage claims, and client visits effortlessly.
              </p>
              <div className="inline-flex items-center gap-2 text-xs font-extrabold text-emerald-800 bg-emerald-100 px-3.5 py-1.5 rounded-full border border-emerald-200 shadow-2xs">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>All Systems 100% Operational</span>
              </div>
            </div>

            {/* Column 2: Product */}
            <div className="space-y-3 text-xs">
              <h4 className="font-black text-slate-900 uppercase tracking-wider">Product Features</h4>
              <ul className="space-y-2.5 font-bold">
                <li><a href="#features" className="hover:text-emerald-600 transition-colors flex items-center gap-1.5"><ChevronRight className="w-3.5 h-3.5 text-emerald-600" /> Live GPS Telemetry</a></li>
                <li><a href="#features" className="hover:text-emerald-600 transition-colors flex items-center gap-1.5"><ChevronRight className="w-3.5 h-3.5 text-emerald-600" /> Geofence Attendance</a></li>
                <li><a href="#features" className="hover:text-emerald-600 transition-colors flex items-center gap-1.5"><ChevronRight className="w-3.5 h-3.5 text-emerald-600" /> Expense Audit OCR</a></li>
                <li><a href="#features" className="hover:text-emerald-600 transition-colors flex items-center gap-1.5"><ChevronRight className="w-3.5 h-3.5 text-emerald-600" /> Client Meeting Log</a></li>
                <li><a href="#features" className="hover:text-emerald-600 transition-colors flex items-center gap-1.5"><ChevronRight className="w-3.5 h-3.5 text-emerald-600" /> Facial Selfie Punch</a></li>
              </ul>
            </div>

            {/* Column 3: Solutions */}
            <div className="space-y-3 text-xs">
              <h4 className="font-black text-slate-900 uppercase tracking-wider">Industry Solutions</h4>
              <ul className="space-y-2.5 font-bold">
                <li><a href="#solutions" className="hover:text-emerald-600 transition-colors flex items-center gap-1.5"><ChevronRight className="w-3.5 h-3.5 text-orange-500" /> Field Sales & CRM</a></li>
                <li><a href="#solutions" className="hover:text-emerald-600 transition-colors flex items-center gap-1.5"><ChevronRight className="w-3.5 h-3.5 text-orange-500" /> FMCG & Retail Beat</a></li>
                <li><a href="#solutions" className="hover:text-emerald-600 transition-colors flex items-center gap-1.5"><ChevronRight className="w-3.5 h-3.5 text-orange-500" /> Field Service Tech</a></li>
                <li><a href="#solutions" className="hover:text-emerald-600 transition-colors flex items-center gap-1.5"><ChevronRight className="w-3.5 h-3.5 text-orange-500" /> Express Courier Fleets</a></li>
                <li><a href="#solutions" className="hover:text-emerald-600 transition-colors flex items-center gap-1.5"><ChevronRight className="w-3.5 h-3.5 text-orange-500" /> Construction Sites</a></li>
              </ul>
            </div>

            {/* Column 4: Quick Links */}
            <div className="space-y-3 text-xs">
              <h4 className="font-black text-slate-900 uppercase tracking-wider">Account & Support</h4>
              <ul className="space-y-2.5 font-bold">
                <li><Link to="/login" className="hover:text-emerald-600 transition-colors">Admin Portal Sign In</Link></li>
                <li><Link to="/register-organization" className="hover:text-emerald-600 transition-colors">Register Organization</Link></li>
                <li><a href="tel:9511450914" className="hover:text-emerald-600 transition-colors text-emerald-700 font-extrabold flex items-center gap-1.5"><PhoneCall className="w-3.5 h-3.5 text-emerald-600" /> Support: +91 9511450914</a></li>
                <li><a href="#pricing" className="hover:text-emerald-600 transition-colors">Pricing Plans</a></li>
                <li><a href="#testimonials" className="hover:text-emerald-600 transition-colors">Client Reviews</a></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-200/90 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4 font-semibold">
            <p>© {new Date().getFullYear()} TrackPro SaaS Platform. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <a href="#" className="hover:text-slate-700 transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-slate-700 transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-slate-700 transition-colors">Security & ISO Compliance</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
