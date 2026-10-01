import React from 'react';
import { useAuth } from '../../context/AuthContext';
import SuperAdminDashboardScreen from './SuperAdminDashboardScreen';
import ManagerDashboardScreen from './ManagerDashboardScreen';
import OrgAdminDashboardScreen from './OrgAdminDashboardScreen';

/**
 * Master Role-Based Dashboard Switcher for Mobile App
 * - SUPER_ADMIN -> SuperAdminDashboardScreen (Multi-Tenant Platform Overview & Razorpay Live)
 * - MANAGER     -> ManagerDashboardScreen (Direct Team Reports & Team Live Map)
 * - ORG_ADMIN   -> OrgAdminDashboardScreen (Company Operations & Organization Pulse)
 */
export default function AdminDashboardScreen() {
  const { user } = useAuth();
  const roleUpper = user?.role ? String(user.role).toUpperCase() : '';

  if (roleUpper === 'SUPER_ADMIN' || roleUpper === 'SUPERADMIN') {
    return <SuperAdminDashboardScreen />;
  }

  if (roleUpper === 'MANAGER') {
    return <ManagerDashboardScreen />;
  }

  // Default for ORG_ADMIN, ADMIN, HR
  return <OrgAdminDashboardScreen />;
}
