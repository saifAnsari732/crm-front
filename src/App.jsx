import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';

// Components
import LoadingScreen from './components/shared/LoadingScreen';
import NetworkStatus from './components/shared/NetworkStatus';
import ErrorBoundary from './components/shared/ErrorBoundary';

// Lazy Loaded Pages
const LandingPage = lazy(() => import('./pages/landing/LandingPage'));
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const RegisterOrganization = lazy(() => import('./pages/auth/RegisterOrganization'));
const ProfilePage = lazy(() => import('./pages/employee/ProfilePage'));

// Super Admin
const SuperAdminDashboard = lazy(() => import('./pages/superadmin/SuperAdminDashboard'));
const SuperAdminOrganizations = lazy(() => import('./pages/superadmin/SuperAdminOrganizations'));
const SuperAdminUsers = lazy(() => import('./pages/superadmin/SuperAdminUsers'));
const SuperAdminPayments = lazy(() => import('./pages/superadmin/SuperAdminPayments'));
const SuperAdminCoupons = lazy(() => import('./pages/superadmin/SuperAdminCoupons'));
const SuperAdminBroadcasts = lazy(() => import('./pages/superadmin/SuperAdminBroadcasts'));
const SuperAdminPlans = lazy(() => import('./pages/superadmin/SuperAdminPlans'));
const SuperAdminHealth = lazy(() => import('./pages/superadmin/SuperAdminHealth'));
const SuperAdminSettings = lazy(() => import('./pages/superadmin/SuperAdminSettings'));

// Org Admin
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminEmployees = lazy(() => import('./pages/admin/AdminEmployees'));
const AdminManagers = lazy(() => import('./pages/admin/AdminManagers'));
const AdminDepartments = lazy(() => import('./pages/admin/AdminDepartments'));
const AdminTeams = lazy(() => import('./pages/admin/AdminTeams'));
const AdminLiveMap = lazy(() => import('./pages/admin/AdminLiveMap'));
const AdminExpenses = lazy(() => import('./pages/admin/AdminExpenses'));
const AdminMeetings = lazy(() => import('./pages/admin/AdminMeetings'));
const AdminAttendance = lazy(() => import('./pages/admin/AdminAttendance'));
const AdminTrackingHistory = lazy(() => import('./pages/admin/AdminTrackingHistory'));
const AdminLeaves = lazy(() => import('./pages/admin/AdminLeaves'));
const AdminTasks = lazy(() => import('./pages/admin/AdminTasks'));
const AdminLeads = lazy(() => import('./pages/admin/AdminLeads'));
const AdminReports = lazy(() => import('./pages/admin/AdminReports'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));
const AdminBilling = lazy(() => import('./pages/admin/AdminBilling'));

const PrivateRoute = ({ children, roles }) => {
  const { user, loading, isAuthenticated } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const userRole = user?.role ? user.role.toUpperCase() : '';

  // Super Admin has master unrestricted access to ALL routes in the application
  if (userRole === 'SUPER_ADMIN' || userRole === 'SUPERADMIN') {
    return children;
  }

  const allowedRoles = roles ? roles.map((r) => r.toUpperCase()) : [];
  const normalizedUserRole = (userRole === 'ORG_ADMIN' || userRole === 'ADMIN') ? 'ADMIN' : userRole;
  const normalizedAllowedRoles = allowedRoles.map(r => (r === 'ORG_ADMIN' || r === 'ADMIN') ? 'ADMIN' : r);

  if (roles && !normalizedAllowedRoles.includes(normalizedUserRole)) {
    if (normalizedUserRole === 'EMPLOYEE') {
      return <Navigate to="/profile" replace />;
    }
    return <Navigate to="/admin" replace />;
  }

  return children;
};

const PublicRoute = ({ children }) => {
  const { isAuthenticated, user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (isAuthenticated) {
    const userRole = user?.role ? user.role.toUpperCase() : '';
    if (userRole === 'SUPER_ADMIN' || userRole === 'SUPERADMIN') {
      return <Navigate to="/super-admin" replace />;
    }
    if (userRole === 'EMPLOYEE') {
      return <Navigate to="/profile" replace />;
    }
    return <Navigate to="/admin" replace />;
  }
  return children;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<LandingPage />} />
    <Route path="/home" element={<LandingPage />} />
    <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
    <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
    <Route path="/register-organization" element={<PublicRoute><RegisterOrganization /></PublicRoute>} />
    <Route path="/org/register" element={<PublicRoute><RegisterOrganization /></PublicRoute>} />

    {/* Super Admin Routes */}
    <Route
      path="/super-admin"
      element={
        <PrivateRoute roles={['SUPER_ADMIN']}>
          <SuperAdminDashboard />
        </PrivateRoute>
      }
    />
    <Route
      path="/superadmin"
      element={
        <PrivateRoute roles={['SUPER_ADMIN']}>
          <SuperAdminDashboard />
        </PrivateRoute>
      }
    />
    <Route
      path="/super-admin/organizations"
      element={
        <PrivateRoute roles={['SUPER_ADMIN']}>
          <SuperAdminOrganizations />
        </PrivateRoute>
      }
    />
    <Route
      path="/super-admin/users"
      element={
        <PrivateRoute roles={['SUPER_ADMIN']}>
          <SuperAdminUsers />
        </PrivateRoute>
      }
    />
    <Route
      path="/super-admin/payments"
      element={
        <PrivateRoute roles={['SUPER_ADMIN']}>
          <SuperAdminPayments />
        </PrivateRoute>
      }
    />
    <Route
      path="/super-admin/coupons"
      element={
        <PrivateRoute roles={['SUPER_ADMIN']}>
          <SuperAdminCoupons />
        </PrivateRoute>
      }
    />
    <Route path="/super-admin/activity" element={<Navigate to="/super-admin" replace />} />
    <Route
      path="/super-admin/broadcasts"
      element={
        <PrivateRoute roles={['SUPER_ADMIN']}>
          <SuperAdminBroadcasts />
        </PrivateRoute>
      }
    />
    <Route
      path="/super-admin/plans"
      element={
        <PrivateRoute roles={['SUPER_ADMIN']}>
          <SuperAdminPlans />
        </PrivateRoute>
      }
    />
    <Route
      path="/super-admin/health"
      element={
        <PrivateRoute roles={['SUPER_ADMIN']}>
          <SuperAdminHealth />
        </PrivateRoute>
      }
    />
    <Route
      path="/super-admin/settings"
      element={
        <PrivateRoute roles={['SUPER_ADMIN']}>
          <SuperAdminSettings />
        </PrivateRoute>
      }
    />

    <Route path="/profile" element={<PrivateRoute roles={['ORG_ADMIN', 'ADMIN', 'HR', 'MANAGER']}><ProfilePage /></PrivateRoute>} />
    <Route path="/admin/profile" element={<PrivateRoute roles={['ORG_ADMIN', 'ADMIN', 'HR', 'MANAGER']}><ProfilePage /></PrivateRoute>} />

    {/* Admin Routes */}
    <Route path="/admin" element={<PrivateRoute roles={['ORG_ADMIN', 'ADMIN', 'HR', 'MANAGER']}><AdminDashboard /></PrivateRoute>} />
    <Route path="/admin/employees" element={<PrivateRoute roles={['ORG_ADMIN', 'ADMIN', 'HR', 'MANAGER']}><AdminEmployees /></PrivateRoute>} />
    <Route path="/admin/managers" element={<PrivateRoute roles={['ORG_ADMIN', 'ADMIN', 'HR']}><AdminManagers /></PrivateRoute>} />
    <Route path="/admin/departments" element={<PrivateRoute roles={['ORG_ADMIN', 'ADMIN', 'HR']}><AdminDepartments /></PrivateRoute>} />
    <Route path="/admin/teams" element={<PrivateRoute roles={['ORG_ADMIN', 'ADMIN', 'HR', 'MANAGER']}><AdminTeams /></PrivateRoute>} />
    <Route path="/admin/live-map" element={<PrivateRoute roles={['ORG_ADMIN', 'ADMIN', 'HR', 'MANAGER']}><AdminLiveMap /></PrivateRoute>} />
    <Route path="/admin/tracking-history" element={<PrivateRoute roles={['ORG_ADMIN', 'ADMIN', 'HR', 'MANAGER']}><AdminTrackingHistory /></PrivateRoute>} />
    <Route path="/admin/km-history" element={<PrivateRoute roles={['ORG_ADMIN', 'ADMIN', 'HR', 'MANAGER']}><AdminTrackingHistory /></PrivateRoute>} />
    <Route path="/admin/expenses" element={<PrivateRoute roles={['ORG_ADMIN', 'ADMIN', 'HR', 'MANAGER']}><AdminExpenses /></PrivateRoute>} />
    <Route path="/admin/meetings" element={<PrivateRoute roles={['ORG_ADMIN', 'ADMIN', 'HR', 'MANAGER']}><AdminMeetings /></PrivateRoute>} />
    <Route path="/admin/attendance" element={<PrivateRoute roles={['ORG_ADMIN', 'ADMIN', 'HR', 'MANAGER']}><AdminAttendance /></PrivateRoute>} />
    <Route path="/admin/leaves" element={<PrivateRoute roles={['ORG_ADMIN', 'ADMIN', 'HR', 'MANAGER']}><AdminLeaves /></PrivateRoute>} />
    <Route path="/admin/tasks" element={<PrivateRoute roles={['ORG_ADMIN', 'ADMIN', 'HR', 'MANAGER']}><AdminTasks /></PrivateRoute>} />
    <Route path="/admin/leads" element={<PrivateRoute roles={['ORG_ADMIN', 'ADMIN', 'HR']}><AdminLeads /></PrivateRoute>} />
    <Route path="/admin/reports" element={<PrivateRoute roles={['ORG_ADMIN', 'ADMIN', 'HR', 'MANAGER']}><AdminReports /></PrivateRoute>} />
    <Route path="/admin/settings" element={<PrivateRoute roles={['ORG_ADMIN', 'ADMIN', 'HR']}><AdminSettings /></PrivateRoute>} />
    <Route path="/admin/billing" element={<PrivateRoute roles={['ORG_ADMIN', 'ADMIN', 'HR']}><AdminBilling /></PrivateRoute>} />
    <Route path="/admin/plan" element={<PrivateRoute roles={['ORG_ADMIN', 'ADMIN', 'HR']}><AdminBilling /></PrivateRoute>} />
  </Routes>
);

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider>
          <BrowserRouter>
            <NetworkStatus />
            <Suspense fallback={<LoadingScreen />}>
              <AppRoutes />
            </Suspense>
            <Toaster
              position="top-right"
              toastOptions={{
                style: {
                  background: '#ffffff',
                  color: '#0f172a',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  fontSize: '14px',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                },
                success: { iconTheme: { primary: '#22c55e', secondary: '#ffffff' } },
                error: { iconTheme: { primary: '#ef4444', secondary: '#ffffff' } },
              }}
            />
          </BrowserRouter>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
