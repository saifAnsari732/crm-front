import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TrackingProvider } from './contexts/TrackingContext';
import { ThemeProvider } from './contexts/ThemeContext';

// Pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import EmployeeDashboard from './pages/employee/EmployeeDashboard';
import TrackingPage from './pages/employee/TrackingPage';
import MeetingsPage from './pages/employee/MeetingsPage';
import ExpensesPage from './pages/employee/ExpensesPage';
import ProfilePage from './pages/employee/ProfilePage';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminEmployees from './pages/admin/AdminEmployees';
import AdminLiveMap from './pages/admin/AdminLiveMap';
import AdminExpenses from './pages/admin/AdminExpenses';
import AdminMeetings from './pages/admin/AdminMeetings';
import AdminAttendance from './pages/admin/AdminAttendance';
import AdminTrackingHistory from './pages/admin/AdminTrackingHistory';
import AdminLeaves from './pages/admin/AdminLeaves';
import AdminTasks from './pages/admin/AdminTasks';
import LeavePage from './pages/employee/LeavePage';
import TasksPage from './pages/employee/TasksPage';
import LoadingScreen from './components/shared/LoadingScreen';
import OfflineIndicator from './components/shared/OfflineIndicator';
import NetworkStatus from './components/shared/NetworkStatus';
import ErrorBoundary from './components/shared/ErrorBoundary';

const PrivateRoute = ({ children, roles }) => {
  const { user, loading, isAuthenticated } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user?.role)) return <Navigate to="/dashboard" replace />;
  return children;
};

const PublicRoute = ({ children }) => {
  const { isAuthenticated, user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (isAuthenticated) {
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
    <Route path="/profile" element={<PrivateRoute roles={['employee', 'admin', 'hr']}><ProfilePage /></PrivateRoute>} />

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
              <AppRoutes />
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
