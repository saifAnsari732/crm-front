import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getSocket } from '../../services/socket.service';
import {
  Bell,
  AlertTriangle,
  Radio,
  X,
  CheckCircle2,
  Sparkles,
  Info,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';

export default function BroadcastAlertPopup() {
  const { user } = useAuth();
  const [activeBroadcast, setActiveBroadcast] = useState(null);
  const [dismissedIds, setDismissedIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('dismissed_broadcasts') || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleBroadcast = (data) => {
      if (!data) return;

      // Role targeting check
      const userRole = (user?.role || '').toUpperCase();
      const targetRole = (data.targetRole || 'ALL').toUpperCase();

      if (targetRole !== 'ALL') {
        const isMatched =
          (targetRole === 'ORG_ADMIN' && (userRole === 'ORG_ADMIN' || userRole === 'ADMIN')) ||
          (targetRole === 'MANAGER' && userRole === 'MANAGER') ||
          (targetRole === 'EMPLOYEE' && (userRole === 'EMPLOYEE' || userRole === 'AGENT'));

        if (!isMatched) return;
      }

      // Organization targeting check
      if (data.targetOrganization && data.targetOrganization !== 'ALL') {
        const userOrgId = user?.organizationId?._id || user?.organizationId;
        if (userOrgId && String(userOrgId) !== String(data.targetOrganization)) {
          return;
        }
      }

      // Play subtle notification chime sound if available
      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.volume = 0.5;
        audio.play().catch(() => {});
      } catch {}

      setActiveBroadcast(data);
    };

    socket.on('platform_broadcast', handleBroadcast);

    return () => {
      socket.off('platform_broadcast', handleBroadcast);
    };
  }, [user]);

  const handleDismiss = () => {
    if (activeBroadcast?._id) {
      const updated = [...dismissedIds, activeBroadcast._id];
      setDismissedIds(updated);
      localStorage.setItem('dismissed_broadcasts', JSON.stringify(updated));
    }
    setActiveBroadcast(null);
  };

  if (!activeBroadcast) return null;

  const isUrgent = activeBroadcast.priority === 'urgent' || activeBroadcast.priority === 'critical';
  const isHigh = activeBroadcast.priority === 'high';

  return (
    <div className="fixed top-5 right-5 z-[9999] max-w-md w-full animate-in slide-in-from-top-4 duration-300">
      <div
        className={`p-5 rounded-3xl shadow-2xl border backdrop-blur-md relative overflow-hidden transition-all ${
          isUrgent
            ? 'bg-gradient-to-br from-rose-900/95 via-rose-950/95 to-slate-900/95 text-white border-rose-500/50 shadow-rose-950/50'
            : isHigh
            ? 'bg-gradient-to-br from-amber-900/95 via-slate-900/95 to-slate-950/95 text-white border-amber-500/50 shadow-amber-950/40'
            : 'bg-gradient-to-br from-slate-900/95 via-indigo-950/95 to-slate-900/95 text-white border-indigo-500/50 shadow-indigo-950/40'
        }`}
      >
        {/* Top Header Badge */}
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                isUrgent
                  ? 'bg-rose-500 text-white animate-pulse'
                  : isHigh
                  ? 'bg-amber-400 text-slate-900 font-extrabold'
                  : 'bg-indigo-500/40 text-indigo-200 border border-indigo-400/30'
              }`}
            >
              <Radio className="w-3 h-3 animate-ping" />
              {isUrgent ? 'URGENT BROADCAST' : isHigh ? 'IMPORTANT NOTICE' : 'PLATFORM ANNOUNCEMENT'}
            </span>
            <span className="text-[11px] text-slate-300 font-medium font-mono">Instant</span>
          </div>

          <button
            onClick={handleDismiss}
            className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition"
            title="Dismiss Announcement"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="pt-3 space-y-2">
          <h3 className="text-base font-bold text-white tracking-tight leading-snug">
            {activeBroadcast.title}
          </h3>

          <p className="text-xs text-slate-200 leading-relaxed font-medium bg-black/25 p-3 rounded-2xl border border-white/5 whitespace-pre-line">
            {activeBroadcast.message}
          </p>

          <div className="flex items-center justify-between pt-2 text-[11px] text-slate-300">
            <span>
              By <span className="font-bold text-white">{activeBroadcast.senderName || 'Super Admin'}</span>
            </span>

            <button
              onClick={handleDismiss}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs shadow-md transition active:scale-95 flex items-center gap-1 cursor-pointer ${
                isUrgent
                  ? 'bg-rose-500 hover:bg-rose-600 text-white'
                  : isHigh
                  ? 'bg-amber-400 hover:bg-amber-500 text-slate-950 font-black'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              <span>Acknowledge</span>
              <CheckCircle2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
