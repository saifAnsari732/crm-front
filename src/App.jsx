import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';

// Components
import LoadingScreen from './components/shared/LoadingScreen';
import OfflineIndicator from './components/shared/OfflineIndicator';
import NetworkStatus from './components/shared/NetworkStatus';
import ErrorBoundary from './components/shared/ErrorBoundary';

// Lazy Loaded Pages
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const ProfilePage = lazy(() => import('./pages/employee/ProfilePage'));

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

const PrivateRoute = ({ children, roles }) => {
  const { user, loading, isAuthenticated } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user?.role)) {
    return <Navigate to="/admin" replace />;
  }
  return children;
};

const PublicRoute = ({ children }) => {
  const { isAuthenticated, user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (isAuthenticated) {
    return <Navigate to="/admin" replace />;
  }
  return children;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Navigate to="/admin" replace />} />
    <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
    <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />

    <Route path="/profile" element={<PrivateRoute roles={['admin', 'hr']}><ProfilePage /></PrivateRoute>} />

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
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
