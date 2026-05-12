import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Upload, CheckCircle } from 'lucide-react';
import { useTracking } from '../../contexts/TrackingContext';

export default function OfflineIndicator() {
  const { isOnline, unsyncedCount, syncOfflineCoordinates } = useTracking();
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncOfflineCoordinates();
    } finally {
      setSyncing(false);
    }
  };

  if (isOnline && unsyncedCount === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-auto">
      {/* Offline Status */}
      {!isOnline && (
        <div className="bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-pulse">
          <WifiOff className="w-4 h-4" />
          <span className="text-sm font-medium">Offline Mode</span>
        </div>
      )}

      {/* Sync Status */}
      {unsyncedCount > 0 && (
        <div className="bg-amber-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4" />
            <span className="text-sm font-medium">{unsyncedCount} location(s) queued</span>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing || !isOnline}
            className="text-xs font-semibold px-2 py-1 bg-white/20 hover:bg-white/30 disabled:opacity-50 rounded transition"
          >
            {syncing ? 'Syncing...' : 'Sync'}
          </button>
        </div>
      )}

      {/* Synced Indicator */}
      {isOnline && unsyncedCount === 0 && (
        <div className="bg-green-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in">
          <CheckCircle className="w-4 h-4" />
          <span className="text-sm font-medium">All synced</span>
        </div>
      )}
    </div>
  );
}
