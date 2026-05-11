import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  LayoutDashboard,
  MapPin,
  Users,
  Receipt,
  User,
  LogOut,
  Bell,
  Menu,
  X,
  ChevronRight,
  Zap,
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/tracking", icon: MapPin, label: "Tracking" },
  { to: "/meetings", icon: Users, label: "Meetings" },
  { to: "/expenses", icon: Receipt, label: "Expenses" },
  { to: "/profile", icon: User, label: "Profile" },
];

export default function EmployeeLayout({ children }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen mesh-bg flex text-[var(--text-main)]">
      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 glass border-r border-[var(--border-color)] bg-[var(--bg-main)]/90 backdrop-blur-xl z-50 flex flex-col transition-transform duration-300
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 lg:static lg:z-auto`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-600 flex items-center justify-center shadow-glow">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-[var(--text-main)] text-sm">
                FieldCRM
              </p>
              <p className="text-[var(--accent-safe)] text-xs">
                Employee Portal
              </p>
            </div>
          </div>
        </div>

        {/* User card */}
        <div className="p-4 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-card)]">
            <div className="w-10 h-10 rounded-full bg-primary-600/30 border border-primary-500/40 flex items-center justify-center text-primary-300 font-bold text-sm flex-shrink-0">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt=""
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                user?.name?.[0]?.toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[var(--text-main)] font-semibold text-sm truncate">
                {user?.name}
              </p>
              <p className="text-[var(--text-muted)] text-xs truncate">
                {user?.employeeId}
              </p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1 ">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{label}</span>
              <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100" />
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-[var(--border-color)]">
          <button
            onClick={logout}
            className="nav-item w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 glass border-b border-[var(--border-color)] bg-[var(--bg-main)]/80 backdrop-blur-xl px-4 lg:px-6 py-3 flex items-center justify-between">
          <button
            className="lg:hidden p-2 rounded-lg hover:bg-[var(--bg-card)]"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5 text-[var(--text-main)]" />
          </button>
          <div className="hidden lg:block">
            <h1 className="text-[var(--text-main)] font-semibold text-sm">
              Good {getGreeting()}, {user?.name?.split(" ")[0]} 👋
            </h1>
            <p className="text-[var(--text-muted)] text-xs">
              {new Date().toLocaleDateString("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl hover:bg-[var(--bg-card)] transition-colors"
              title="Toggle Theme"
            >
              {theme === "dark" ? (
                <Sun className="w-5 h-5 text-amber-400" />
              ) : (
                <Moon className="w-5 h-5 text-blue-600" />
              )}
            </button>
            <button className="relative p-2 rounded-xl hover:bg-[var(--bg-card)] transition-colors">
              <Bell className="w-5 h-5 text-[var(--text-main)]/70" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            </button>
            <div className="w-8 h-8 rounded-full bg-primary-600/30 border border-primary-500/40 flex items-center justify-center text-primary-300 font-bold text-xs">
              {user?.name?.[0]?.toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto pb-20 lg:pb-6">{children}</main>
      </div>

      {/* Bottom nav (mobile) */}
      <nav className="fixed bottom-0  left-0 right-0 lg:hidden z-30 bg-[var(--bg-sidebar)]  border-t border-[var(--border-color)] px-2 py-2 flex items-center justify-around">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center  gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200 ${
                isActive
                  ? "text-primary-400 bg-primary-600/15"
                  : "text-[var(--text-main)] hover:text-[var(--text-main)]"
              }`
            }
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Morning";
  if (h < 17) return "Afternoon";
  return "Evening";
}
