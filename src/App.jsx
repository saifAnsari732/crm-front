import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';

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
import LoadingScreen from './components/shared/LoadingScreen';

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
    <Route path="/profile" element={<PrivateRoute roles={['employee', 'admin', 'hr']}><ProfilePage /></PrivateRoute>} />

    {/* Admin */}
    <Route path="/admin" element={<PrivateRoute roles={['admin', 'hr']}><AdminDashboard /></PrivateRoute>} />
    <Route path="/admin/employees" element={<PrivateRoute roles={['admin', 'hr']}><AdminEmployees /></PrivateRoute>} />
    <Route path="/admin/live-map" element={<PrivateRoute roles={['admin', 'hr']}><AdminLiveMap /></PrivateRoute>} />
    <Route path="/admin/expenses" element={<PrivateRoute roles={['admin', 'hr']}><AdminExpenses /></PrivateRoute>} />
    <Route path="/admin/meetings" element={<PrivateRoute roles={['admin', 'hr']}><AdminMeetings /></PrivateRoute>} />
    <Route path="/admin/attendance" element={<PrivateRoute roles={['admin', 'hr']}><AdminAttendance /></PrivateRoute>} />

    <Route path="*" element={<Navigate to="/login" replace />} />
  </Routes>
);

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            style: { background: '#1e293b', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '14px' },
            success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  );
}
