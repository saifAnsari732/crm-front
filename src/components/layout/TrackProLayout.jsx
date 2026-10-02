import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Building2,
  Users2,
  CalendarCheck,
  MapPin,
  ClipboardList,
  BarChart3,
  Receipt,
  Calendar,
  Bell,
  Search,
  ChevronDown,
  LogOut,
  Menu,
  X,
  Compass,
  CheckSquare,
  Shield,
  Layers,
  Briefcase,
  Settings,
  CreditCard,
  AlertTriangle,
  Route,
  Tag,
  Activity,
  Server,
} from 'lucide-react';
import Avatar from '../shared/Avatar';
import BroadcastAlertPopup from '../shared/BroadcastAlertPopup';
import toast from 'react-hot-toast';

export default function KisanConnectLayout({ children }) {
  const { user, organization, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showOrgDropdown, setShowOrgDropdown] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  const userRole = user?.role ? user.role.toUpperCase() : 'EMPLOYEE';
  const isSuperAdmin = userRole === 'SUPER_ADMIN' || userRole === 'SUPERADMIN';
  const isOrgAdmin = userRole === 'ORG_ADMIN' || userRole === 'ADMIN' || userRole === 'HR';
  const isManager = userRole === 'MANAGER';

  // Plan verification: true if active and not expired (no trial days)
  const isPlanActive = isSuperAdmin || (
    organization?.status === 'active' &&
    Boolean(organization?.plan?.expiresAt) &&
    new Date(organization.plan.expiresAt) > new Date()
  );

  const navItems = [
    { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
    { to: '/admin/employees', icon: Users, label: 'Employees' },
    { to: '/admin/managers', icon: UserCheck, label: 'Managers', hideForManager: true },
    { to: '/admin/departments', icon: Building2, label: 'Departments', hideForManager: true },
    { to: '/admin/teams', icon: Users2, label: 'Teams', hideForManager: true },
    { to: '/admin/attendance', icon: CalendarCheck, label: 'Attendance' },
    { to: '/admin/meetings', icon: Briefcase, label: 'Visits & Meetings' },
    { to: '/admin/live-map', icon: Compass, label: 'Live Tracking' },
    { to: '/admin/km-history', icon: Route, label: 'KM History' },
    { to: '/admin/tasks', icon: ClipboardList, label: 'Tasks' },
    { to: '/admin/reports', icon: BarChart3, label: 'Reports' },
    { to: '/admin/expenses', icon: Receipt, label: 'Expenses' },
    { to: '/admin/leaves', icon: Calendar, label: 'Leave' },
    { to: '/admin/leads', icon: Layers, label: 'Leads' },
    { to: '/admin/billing', icon: CreditCard, label: 'Subscription & Plans', hideForManager: true, isBilling: true },
    { to: '/admin/settings', icon: Settings, label: 'Org Settings', hideForManager: true },
  ];

  const visibleNav = navItems.filter((item) => !(isManager && item.hideForManager));

  const orgName = organization?.name || user?.organizationName || (user?.role === 'ORG_ADMIN' ? user?.name : 'KISAN CHOICE');
  const userInitials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'RA';

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex font-sans antialiased">
      {/* Real-Time Live Broadcast Alert Popup for All Users */}
      <BroadcastAlertPopup />
      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* KisanConnect Sidebar */}
      <aside
        className={`fixed top-0 left-0 bottom-0 w-72 bg-white border-r-2 border-rose-200/90 shadow-sm shadow-rose-100/40 z-50 flex flex-col justify-between transition-transform duration-200 ease-in-out print:hidden ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="flex flex-col flex-1 min-h-0">
          {/* Logo & Brand Header (Super Company Brand) */}
          <div className="h-16 px-5 flex items-center justify-between border-b border-rose-100 bg-white">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-xl overflow-hidden border border-rose-200/80 shadow-xs bg-white flex-shrink-0 flex items-center justify-center p-0.5">
                {organization?.logo ? (
                  <img
                    src='/images/icon.jpg'
                    alt={orgName}
                    className="w-full h-full object-contain rounded-lg"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div className={`w-full h-full bg-gradient-to-br from-rose-500 to-rose-600 text-white rounded-lg flex items-center justify-center font-black text-xs tracking-tight ${organization?.logo ? 'hidden' : 'flex'}`}>
                  {orgName ? orgName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() : 'KC'}
                </div>
              </div>
              <div className="min-w-0 flex flex-col justify-center">
                <img
                  src="/images/superCompanyLOGO.png"
                  alt="Super Company Logo"
                  className="h-20  w-auto object-contain"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = '/images/kisanLogo.jpg';
                  }}
                />
              </div>
            </div>
            <button className="lg:hidden text-slate-400 p-1 hover:text-rose-500" onClick={() => setMobileMenuOpen(false)}>
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-3 py-2.5 space-y-1 overflow-y-auto mt-[10px]">
            {isSuperAdmin ? (
              <div className="space-y-1">
                <div className="px-3 pb-1.5 text-[10px] font-black text-rose-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" /> Super Admin Console
                </div>

                {[
                  { to: '/super-admin', icon: Shield, label: 'Platform Overview', end: true },
                  { to: '/super-admin/organizations', icon: Building2, label: 'Customer Organizations' },
                  { to: '/super-admin/users', icon: Users, label: 'Global Users Directory' },
                  { to: '/super-admin/payments', icon: CreditCard, label: 'Razorpay Payments' },
                  { to: '/super-admin/coupons', icon: Tag, label: 'Discount Coupons' },
                  { to: '/super-admin/broadcasts', icon: Bell, label: 'Platform Broadcasts' },
                  { to: '/super-admin/plans', icon: Layers, label: 'SaaS Pricing Plans' },
                  { to: '/super-admin/health', icon: Server, label: 'System Health & DB' },
                  { to: '/super-admin/settings', icon: Settings, label: 'System Settings' },
                ].map((item) => {
                  const Icon = item.icon;
                  const isActive = item.end
                    ? location.pathname === item.to || location.pathname === '/superadmin'
                    : location.pathname.startsWith(item.to);

                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-2.5 py-2 px-3 rounded-xl text-[18px] transition-all duration-150 group ${
                        isActive
                          ? 'bg-rose-50 text-rose-600 font-bold border-l-4 border-rose-500 pl-3.5 shadow-sm'
                          : 'text-slate-700 font-medium hover:bg-rose-50/60 hover:text-rose-600 pl-3.5 hover:border-l-4 hover:border-rose-300'
                      }`}
                    >
                      <Icon className={`w-5 h-5 flex-shrink-0 transition-colors ${isActive ? 'text-rose-600 stroke-[2.2]' : 'text-slate-500 group-hover:text-rose-500 stroke-[1.8]'}`} />
                      <span className="tracking-tight">{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            ) : (
              visibleNav.map((item) => {
                const Icon = item.icon;
                const isActive = item.end
                  ? location.pathname === item.to
                  : location.pathname.startsWith(item.to);

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-2.5 py-2.5 px-3 rounded-xl text-[18px] transition-all duration-150 group ${
                      isActive
                        ? 'bg-rose-50 text-rose-600 font-bold border-l-4 border-rose-500 pl-3.5 shadow-sm'
                        : 'text-slate-700 font-medium hover:bg-rose-50/60 hover:text-rose-600 pl-3.5 hover:border-l-4 hover:border-rose-300'
                    }`}
                  >
                    <Icon className={`w-5 h-5 flex-shrink-0 transition-colors ${isActive ? 'text-rose-600 stroke-[2.2]' : 'text-slate-500 group-hover:text-rose-500 stroke-[1.8]'}`} />
                    <span className="tracking-tight">{item.label}</span>
                    {item.isBilling && !isPlanActive && isOrgAdmin && (
                      <span className="ml-auto text-[9px] font-black uppercase tracking-wider bg-rose-600 text-white px-1.5 py-0.5 rounded-full shadow-xs animate-pulse">
                        Unpaid
                      </span>
                    )}
                  </NavLink>
                );
              })
            )}
          </nav>
        </div>

        {/* Bottom Sidebar: Organization Switcher or SuperAdmin Badge & User Profile */}
        <div className="p-3 border-t border-rose-100 space-y-2 bg-white">
          {isSuperAdmin ? (
            /* Super Admin Status Card */
            <div className="p-2.5 bg-gradient-to-r from-rose-50 to-indigo-50 border border-rose-200 rounded-xl flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-rose-600 text-white flex items-center justify-center font-black text-xs shadow-xs flex-shrink-0">
                  <Shield className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[9px] font-black uppercase text-rose-700 tracking-wider block">Super Admin</span>
                  <span className="text-[11px] font-bold text-slate-800 truncate block">Master Platform Control</span>
                </div>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" title="Active Master Session" />
            </div>
          ) : (
            /* Organization Switcher Card for Tenant Users */
            <div className="relative">
              <button
                onClick={() => setShowOrgDropdown(!showOrgDropdown)}
                className="w-full flex items-center justify-between p-2.5 rounded-xl border border-rose-200 bg-rose-50/40 hover:bg-rose-50 hover:border-rose-400 text-left transition duration-150 shadow-xs cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-white text-rose-700 flex items-center justify-center font-bold text-xs flex-shrink-0 overflow-hidden border border-rose-200 p-0.5 shadow-xs">
                    {organization?.logo || user?.organizationLogo || user?.organization?.logo ? (
                      <img
                        src={organization?.logo || user?.organizationLogo || user?.organization?.logo}
                        alt={orgName}
                        className="w-full h-full object-contain rounded-md"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div
                      className={`w-full h-full bg-gradient-to-br from-rose-500 to-rose-600 text-white rounded-md flex items-center justify-center font-black text-[11px] tracking-tight ${
                        (organization?.logo || user?.organizationLogo || user?.organization?.logo) ? 'hidden' : 'flex'
                      }`}
                    >
                      {orgName
                        ? orgName
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()
                        : 'KC'}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] text-rose-600 font-extrabold block uppercase tracking-wider">Organization</span>
                    <span className="text-xs font-extrabold text-slate-900 truncate block">{orgName}</span>
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
              </button>
            </div>
          )}

          {/* User Profile Card */}
          <div
            onClick={() => navigate('/profile')}
            className="flex items-center justify-between p-2 rounded-xl hover:bg-rose-50/80 transition cursor-pointer border border-transparent hover:border-rose-200"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Avatar src={user?.avatar} name={user?.name || (isSuperAdmin ? 'KisanConnect Super Admin' : 'Kisan Choice')} size="sm" />
              <div className="min-w-0">
                <span className="text-xs font-extrabold text-slate-900 truncate block">{user?.name || (isSuperAdmin ? 'Super Admin' : 'Kisan Choice')}</span>
                <span className="text-[10px] text-slate-500 font-semibold truncate block capitalize">
                  {isSuperAdmin ? 'Super Administrator' : userRole === 'ORG_ADMIN' ? 'Organization Admin' : userRole.toLowerCase()}
                </span>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                logout();
              }}
              title="Sign Out"
              className="text-slate-500 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-100 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-72 print:pl-0">
        {/* Full-Width Red Header Alert Bar: Plan Not Active */}
        {!isPlanActive && isOrgAdmin && (
          <div className="w-full bg-red-600 border-b border-red-700 text-white px-4 sm:px-6 py-2.5 shadow-md flex items-center justify-between gap-3 text-xs sm:text-sm font-bold sticky top-0 z-50 animate-pulse print:hidden">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping flex-shrink-0" />
              <AlertTriangle className="w-5 h-5 flex-shrink-0 text-white" />
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <span className="bg-black/30 text-white px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wider">
                  PLAN NOT ACTIVE
                </span>
                <span className="font-extrabold uppercase tracking-wide">
                  BILLING ENABLE FIRST
                </span>
                <span className="hidden lg:inline font-semibold text-red-100">
                  — Please purchase a subscription plan to add employees & unlock full operations.
                </span>
              </div>
            </div>

            <button
              onClick={() => navigate('/admin/billing')}
              className="bg-white text-red-700 hover:bg-red-50 hover:shadow-md px-4 py-1.5 rounded-xl text-xs font-black shadow-sm transition transform active:scale-95 whitespace-nowrap flex items-center gap-1.5 flex-shrink-0 uppercase tracking-wider"
            >
              <CreditCard className="w-3.5 h-3.5" /> Enable Billing
            </button>
          </div>
        )}

        {/* KisanConnect Topbar */}
        <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-30 px-6 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-3 flex-1 max-w-xl">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Global Search with Ctrl+K badge */}
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search employees, IDs, or anything..."
                className="w-full pl-10 pr-16 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-300 text-slate-900 placeholder:text-slate-400 transition"
              />
              <span className="absolute right-3 top-2.5 text-[10px] font-medium text-slate-400 border border-slate-200 bg-white px-1.5 py-0.5 rounded shadow-xs">
                Ctrl + K
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 ml-4">
            {/* Bell Notification with Badge */}
            <button className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                3
              </span>
            </button>

            {/* User Profile in Topbar */}
            <div
              onClick={() => navigate('/profile')}
              className="flex items-center gap-3 pl-2 border-l border-slate-200 cursor-pointer hover:opacity-80 transition"
            >
              <Avatar src={user?.avatar} name={user?.name || 'Kisan Choice'} size="sm" />
              <div className="hidden sm:block text-left">
                <span className="text-xs font-bold text-slate-900 block leading-tight">{user?.name || 'Kisan Choice'}</span>
                <span className="text-[10px] text-slate-500 font-medium block">
                  {userRole === 'ORG_ADMIN' ? 'Organization Admin' : userRole.toLowerCase()}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Screen Content Outlet */}
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto w-full min-w-0 print:p-0 print:m-0 print:overflow-visible">{children}</main>
      </div>
    </div>
  );
}
