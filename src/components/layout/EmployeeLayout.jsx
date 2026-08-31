import React, { useState, useEffect, useCallback } from "react";
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
  Target,
  ClipboardList,
  AlertCircle,
  Check,

} from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";
import { taskAPI,leadAPI } from "../../services/api.service";
import toast from 'react-hot-toast';

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/tracking", icon: MapPin, label: "Tracking" },
  { to: "/leads", icon: Target, label: "Leads" },
  { to: "/tasks", icon: ClipboardList, label: "Action Plan" },
  { to: "/profile", icon: User, label: "Profile" },
];

export default function EmployeeLayout({ children }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationCount, setNotificationCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    try {
      const [tasksRes, leadsRes, notifsRes] = await Promise.all([
        taskAPI.getMy({ limit: 10 }),
        leadAPI.getAll({ limit: 10 }),
        import('../../services/api.service').then(m => m.notificationAPI.getAll())
      ]);
       
      const pendingTasks = (tasksRes.data.tasks || []).filter(t => t.status !== 'completed').slice(0, 3);
      const newLeads = (leadsRes.data.leads || []).slice(0, 2);
      const dbNotifs = (notifsRes.data.notifications || []).slice(0, 5);

      const items = [
        ...dbNotifs.map(n => ({ type: n.type || 'alert', title: n.title, date: n.createdAt, data: n, message: n.message })),
        ...pendingTasks.map(t => ({ type: 'task', title: t.title, date: t.dueDate, data: t })),
        ...newLeads.map(l => ({ type: 'lead', title: l.name, date: l.createdAt, data: l }))
      ];
      
      // Sort by date newest first
      items.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      setNotifications(items);
      setNotificationCount(notifsRes.data.unread || items.length);
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Refresh every 30 seconds
    
    // Listen for high-priority socket alerts (like no-movement)
    const handleAppAlert = (e) => {
      const data = e.detail;
      toast(
        (t) => (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-red-500">
              <AlertCircle className="w-8 h-8 animate-pulse" />
              <p className="font-black text-lg">{data.title || '⚠️ ALERT'}</p>
            </div>
            <p className="font-bold text-sm text-[var(--text-main)]">{data.message}</p>
            <button onClick={() => toast.dismiss(t.id)} className="mt-2 bg-red-500 text-white rounded-lg px-4 py-2 font-bold uppercase text-xs w-full text-center hover:bg-red-600 transition-colors">
              I Understand / Will Move
            </button>
          </div>
        ),
        { duration: 15000, style: { border: '2px solid red', padding: '16px', borderRadius: '16px', background: 'var(--bg-card)', boxShadow: '0 10px 40px -10px rgba(239,68,68,0.5)' } }
      );
    };
    
    window.addEventListener('app_alert', handleAppAlert);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('app_alert', handleAppAlert);
    };
  }, [fetchNotifications]);

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
        className={`fixed top-0 left-0 h-full w-64 glass border-r border-[var(--border-color)] bg-[var(--bg-main)] z-50 flex flex-col transition-transform duration-300
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
                Kisanteam CRM
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
            <button 
              onClick={() => setNotificationOpen(!notificationOpen)}
              className="relative p-2 rounded-xl hover:bg-[var(--bg-card)] transition-colors"
              title="Notifications"
            >
              <Bell className="w-8 h-8 text-[var(--text-main)]/70" />
              {notificationCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                  {notificationCount > 9 ? '9+' : notificationCount}
                </span>
              )}
            </button>
            <div className="w-8 h-8 rounded-full text-black bg-primary-600/30 border border-primary-500/40 flex items-center justify-center text-primary-300 font-bold text-xs">
              {user?.name?.[0]?.toUpperCase()}
            </div>
          </div>
        </header>

        {/* Notifications Panel */}
        {notificationOpen && (
          <>
            <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setNotificationOpen(false)} />
            <div className="absolute top-16 right-4 w-96 max-w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-2xl shadow-2xl z-50 max-h-[500px] overflow-y-auto">
              <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between sticky top-0 bg-[var(--bg-main)]">
                <h3 className="font-bold text-[var(--text-main)] flex items-center gap-2">
                  <Bell className="w-4 h-4 text-primary-500" />
                  Notifications ({notificationCount})
                </h3>
                <button 
                  onClick={() => setNotificationOpen(false)}
                  className="p-1 hover:bg-[var(--bg-card)] rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <AlertCircle className="w-8 h-8 text-[var(--text-muted)] opacity-50 mx-auto mb-2" />
                  <p className="text-[var(--text-muted)] text-sm">No new notifications</p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-color)]">
                  {notifications.map((notif, i) => (
                    <div 
                      key={i} 
                      onClick={() => {
                        if (notif.type === 'task') navigate('/tasks');
                        if (notif.type === 'lead') navigate('/leads');
                        setNotificationOpen(false);
                      }}
                      className="p-4 hover:bg-[var(--bg-card)] transition-colors cursor-pointer"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg flex-shrink-0 ${
                          notif.type === 'task' 
                            ? 'bg-amber-500/20 text-amber-500' 
                            : notif.type === 'alert' || notif.type === 'system'
                            ? 'bg-red-500/20 text-red-500'
                            : 'bg-violet-500/20 text-violet-500'
                        }`}>
                          {notif.type === 'task' ? (
                            <ClipboardList className="w-4 h-4" />
                          ) : notif.type === 'alert' || notif.type === 'system' ? (
                            <AlertCircle className="w-4 h-4" />
                          ) : (
                            <Users className="w-4 h-4" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-semibold text-sm truncate ${notif.type === 'alert' ? 'text-red-500' : 'text-[var(--text-main)]'}`}>
                            {notif.title}
                          </p>
                          {notif.message && (
                            <p className="text-[var(--text-muted)] text-xs mt-0.5 line-clamp-2">
                              {notif.message}
                            </p>
                          )}
                          <p className="text-[var(--text-muted)] text-xs mt-1">
                            {notif.type.toUpperCase()} • {new Date(notif.date).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0 mt-2" />
                       <Check onClick={() => setNotifications([])}/>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Page content */}
        <main className="flex-1 overflow-auto pb-20 lg:pb-6">{children}</main>
      </div>

      {/* Bottom nav (mobile) */}
      <nav className="fixed bottom-0  left-0 right-0 lg:hidden z-30 bg-[var(--bg-sidebar)]  border-t border-[var(--border-color)] px-2 py-2 flex items-center justify-around">
        {navItems.slice(0, 4).map(({ to, icon: Icon, label }) => (
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
