import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TrackingProvider } from './contexts/TrackingContext';
import { ThemeProvider } from './contexts/ThemeContext';

// Components
import LoadingScreen from './components/shared/LoadingScreen';
import OfflineIndicator from './components/shared/OfflineIndicator';
import NetworkStatus from './components/shared/NetworkStatus';
import ErrorBoundary from './components/shared/ErrorBoundary';

// Lazy Loaded Pages
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const EmployeeDashboard = lazy(() => import('./pages/employee/EmployeeDashboard'));
const TrackingPage = lazy(() => import('./pages/employee/TrackingPage'));
const MeetingsPage = lazy(() => import('./pages/employee/MeetingsPage'));
const ExpensesPage = lazy(() => import('./pages/employee/ExpensesPage'));
const ProfilePage = lazy(() => import('./pages/employee/ProfilePage'));
const LeavePage = lazy(() => import('./pages/employee/LeavePage'));
const TasksPage = lazy(() => import('./pages/employee/TasksPage'));
const EmployeeLeads = lazy(() => import('./pages/employee/EmployeeLeads'));

const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminEmployees = lazy(() => import('./pages/admin/AdminEmployees'));
const AdminLiveMap = lazy(() => import('./pages/admin/AdminLiveMap'));
const AdminExpenses = lazy(() => import('./pages/admin/AdminExpenses'));
const AdminMeetings = lazy(() => import('./pages/admin/AdminMeetings'));
const AdminAttendance = lazy(() => import('./pages/admin/AdminAttendance'));
const AdminTrackingHistory = lazy(() => import('./pages/admin/AdminTrackingHistory'));
const AdminLeaves = lazy(() => import('./pages/admin/AdminLeaves'));
const AdminTasks = lazy(() => import('./pages/admin/AdminTasks'));
const AdminLeads = lazy(() => import('./pages/admin/AdminLeads'));
const AdminReports = lazy(() => import('./pages/admin/AdminReports'));

const ManagerDashboard = lazy(() => import('./pages/manager/ManagerDashboard'));
const ManagerTeam = lazy(() => import('./pages/manager/ManagerTeam'));
const ManagerExpenses = lazy(() => import('./pages/manager/ManagerExpenses'));
const ManagerAttendance = lazy(() => import('./pages/manager/ManagerAttendance'));
const ManagerTravelReport = lazy(() => import('./pages/manager/ManagerTravelReport'));

const PrivateRoute = ({ children, roles }) => {
  const { user, loading, isAuthenticated } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user?.role)) {
    if (user?.role === 'manager') return <Navigate to="/manager" replace />;
    if (user?.role === 'admin') return <Navigate to="/admin" replace />;
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

const PublicRoute = ({ children }) => {
  const { isAuthenticated, user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (isAuthenticated) {
    if (user?.role === 'manager') return <Navigate to="/manager" replace />;
    return <Navigate to={user?.role === 'employee' ? '/dashboard' : '/admin'} replace />;
  }
  return children;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Navigate to="/login" replace />} />
    <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
    <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />

    {/* Employee */}
    <Route path="/dashboard" element={<PrivateRoute roles={['employee']}><EmployeeDashboard /></PrivateRoute>} />
    <Route path="/tracking" element={<PrivateRoute roles={['employee']}><TrackingPage /></PrivateRoute>} />
    <Route path="/meetings" element={<PrivateRoute roles={['employee']}><MeetingsPage /></PrivateRoute>} />
    <Route path="/expenses" element={<PrivateRoute roles={['employee']}><ExpensesPage /></PrivateRoute>} />
    <Route path="/leaves" element={<PrivateRoute roles={['employee']}><LeavePage /></PrivateRoute>} />
    <Route path="/tasks" element={<PrivateRoute roles={['employee']}><TasksPage /></PrivateRoute>} />
    <Route path="/leads" element={<PrivateRoute roles={['employee']}><EmployeeLeads /></PrivateRoute>} />
    <Route path="/profile" element={<PrivateRoute roles={['employee', 'admin', 'hr', 'manager']}><ProfilePage /></PrivateRoute>} />

    {/* Manager */}
    <Route path="/manager" element={<PrivateRoute roles={['manager']}><ManagerDashboard /></PrivateRoute>} />
    <Route path="/manager/team" element={<PrivateRoute roles={['manager']}><ManagerTeam /></PrivateRoute>} />
    <Route path="/manager/travel" element={<PrivateRoute roles={['manager']}><ManagerTravelReport /></PrivateRoute>} />
    <Route path="/manager/expenses" element={<PrivateRoute roles={['manager']}><ManagerExpenses /></PrivateRoute>} />
    <Route path="/manager/attendance" element={<PrivateRoute roles={['manager']}><ManagerAttendance /></PrivateRoute>} />

    {/* Admin */}
    <Route path="/admin" element={<PrivateRoute roles={['admin', 'hr']}><AdminDashboard /></PrivateRoute>} />
    <Route path="/admin/employees" element={<PrivateRoute roles={['admin', 'hr']}><AdminEmployees /></PrivateRoute>} />
    <Route path="/admin/live-map" element={<PrivateRoute roles={['admin', 'hr']}><AdminLiveMap /></PrivateRoute>} />
    <Route path="/admin/tracking-history" element={<PrivateRoute roles={['admin', 'hr']}><AdminTrackingHistory /></PrivateRoute>} />
    <Route path="/admin/expenses" element={<PrivateRoute roles={['admin', 'hr']}><AdminExpenses /></PrivateRoute>} />
    <Route path="/admin/meetings" element={<PrivateRoute roles={['admin', 'hr']}><AdminMeetings /></PrivateRoute>} />
    <Route path="/admin/attendance" element={<PrivateRoute roles={['admin', 'hr']}><AdminAttendance /></PrivateRoute>} />
    <Route path="/admin/leaves" element={<PrivateRoute roles={['admin', 'hr']}><AdminLeaves /></PrivateRoute>} />
    <Route path="/admin/tasks" element={<PrivateRoute roles={['admin', 'hr']}><AdminTasks /></PrivateRoute>} />
    <Route path="/admin/leads" element={<PrivateRoute roles={['admin', 'hr']}><AdminLeads /></PrivateRoute>} />
    <Route path="/admin/reports" element={<PrivateRoute roles={['admin', 'hr']}><AdminReports /></PrivateRoute>} />

  </Routes>
);

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider>
          <TrackingProvider>
            <BrowserRouter>
              <NetworkStatus />
              <Suspense fallback={<LoadingScreen />}>
                <AppRoutes />
              </Suspense>
              <OfflineIndicator />
              <Toaster
                position="top-right"
                toastOptions={{
                  style: { background: '#1e293b', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '14px' },
                  success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
                  error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
                }}
              />
            </BrowserRouter>
          </TrackingProvider>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
