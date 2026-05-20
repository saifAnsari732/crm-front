import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard, Users, Receipt, Calendar,
  LogOut, Bell, Menu, Zap, Clock, Settings
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { Sun, Moon } from 'lucide-react';

const navItems = [
  { to: '/manager', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/manager/team', icon: Users, label: 'My Team' },
  { to: '/manager/travel', icon: Clock, label: 'Travel Report' },
  { to: '/manager/expenses', icon: Receipt, label: 'Expenses' },
  { to: '/manager/attendance', icon: Calendar, label: 'Attendance' },
];

export default function ManagerLayout({ children }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen mesh-bg flex text-[var(--text-main)]">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full w-64 z-50 flex flex-col border-r border-[var(--border-color)] bg-[var(--bg-sidebar)] backdrop-blur-xl transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:z-auto`}>
        <div className="p-6 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-glow">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-[var(--text-main)] text-sm">FieldCRM</p>
              <p className="text-[var(--accent-safe)] text-xs font-medium">Manager Panel</p>
            </div>
          </div>
        </div>

        <div className="p-4 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-card)]">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-[var(--text-main)] font-semibold text-sm truncate">{user?.name}</p>
              <p className="text-[var(--accent-safe)] text-xs capitalize">{user?.designation || user?.role}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 ">
          <p className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-widest mb-3 px-2">Navigation</p>
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink key={to} to={to} end={end} onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-[var(--border-color)] space-y-1">
          <NavLink to="/profile" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Settings className="w-4 h-4" /><span>Settings</span>
          </NavLink>
          <button onClick={logout} className="nav-item w-full text-red-400 hover:text-red-300 hover:bg-red-500/10">
            <LogOut className="w-4 h-4" /><span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 border-b border-[var(--border-color)] bg-[var(--bg-header)] backdrop-blur-xl px-4 lg:px-6 py-3 flex items-center justify-between">
          <button className="lg:hidden p-2 rounded-lg hover:bg-[var(--bg-card)]" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5 text-[var(--text-main)]" />
          </button>
          <div className="hidden lg:block">
            <h1 className="text-[var(--text-main)] font-semibold text-sm">Manager Dashboard</h1>
            <p className="text-[var(--text-muted)] text-xs">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button 
              onClick={toggleTheme}
              className="p-2 rounded-xl hover:bg-[var(--bg-card)] transition-colors"
              title="Toggle Theme"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-blue-600" />}
            </button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs">
              {user?.name?.[0]?.toUpperCase()}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto pb-6">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[var(--bg-sidebar)] lg:hidden z-30 border-t border-[var(--border-color)] backdrop-blur-xl px-2 py-2 flex items-center justify-around">
        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all duration-200 ${
                isActive ? 'text-primary-400 bg-primary-600/15' : 'text-[var(--text-main)]'
              }`}>
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
