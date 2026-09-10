import React from 'react';
import { useAuth } from '../../context/AuthContext';
import TrackingScreen from '../../screens/employee/TrackingScreen';
import AdminMonitoringScreen from '../../screens/admin/AdminMonitoringScreen';

export default function DynamicTrackingScreen() {
  const { user } = useAuth();
  const isAdminOrManager = user?.role === 'admin' || user?.role === 'manager';

  if (isAdminOrManager) {
    return <AdminMonitoringScreen />;
  }

  return <TrackingScreen />;
}

