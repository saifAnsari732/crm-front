import React, { useEffect, useState } from 'react';
import EmployeeLayout from '../../components/layout/EmployeeLayout';
import useTracking from '../../hooks/useTracking';
import { MapPin, Navigation, Clock, Zap, Activity, AlertCircle } from 'lucide-react';

export default function TrackingPage() {
  const { isTracking, currentLocation, totalDistance, currentSpeed, routePath, error, toggleTracking } = useTracking();
  const [elapsed, setElapsed] = useState(0);
  const [startTime, setStartTime] = useState(null);

  useEffect(() => {
    if (isTracking && !startTime) setStartTime(Date.now());
    if (!isTracking) { setStartTime(null); setElapsed(0); }
  }, [isTracking]);

  useEffect(() => {
    if (!isTracking || !startTime) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(t);
  }, [isTracking, startTime]);

  const formatTime = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return [h, m, sec].map(v => String(v).padStart(2, '0')).join(':');
  };

  return (
    <EmployeeLayout>
      <div className="p-4 lg:p-6 space-y-6 max-w-2xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-white text-2xl font-bold">Live Tracking</h1>
          <p className="text-white/40 text-sm">Monitor your field activity in real-time</p>
        </div>

        {/* Big Toggle Button */}
        <div className="flex flex-col items-center py-8">
          <div className="relative">
            {isTracking && (
              <>
                <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping scale-125" />
                <div className="absolute inset-0 rounded-full bg-emerald-500/10 animate-ping scale-150" style={{ animationDelay: '0.3s' }} />
              </>
            )}
            <button
              onClick={toggleTracking}
              className={`relative w-36 h-36 rounded-full border-4 transition-all duration-500 flex flex-col items-center justify-center gap-2 font-bold text-lg active:scale-95
                ${isTracking
                  ? 'bg-emerald-600 border-emerald-400 text-white shadow-glow-green'
                  : 'bg-dark-800 border-white/20 text-white hover:border-primary-500/60 hover:bg-dark-700'
                }`}>
              {isTracking ? (
                <>
                  <div className="w-5 h-5 rounded-sm bg-white" />
                  <span className="text-sm font-bold">STOP</span>
                </>
              ) : (
                <>
                  <MapPin className="w-8 h-8" />
                  <span className="text-sm font-bold">START</span>
                </>
              )}
            </button>
          </div>

          <div className="mt-5 text-center">
            {isTracking ? (
              <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Tracking Active
              </div>
            ) : (
              <p className="text-white/40 text-sm">Tap to start GPS tracking</p>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Distance', value: `${totalDistance.toFixed(2)} km`, icon: Navigation, color: 'text-blue-400' },
            { label: 'Speed', value: `${currentSpeed} km/h`, icon: Activity, color: 'text-violet-400' },
            { label: 'Time', value: isTracking ? formatTime(elapsed) : '00:00:00', icon: Clock, color: 'text-amber-400' },
          ].map((s, i) => (
            <div key={i} className="glass-card p-4 text-center">
              <s.icon className={`w-5 h-5 ${s.color} mx-auto mb-2`} />
              <p className={`font-bold text-base ${isTracking ? s.color : 'text-white/40'}`}>{s.value}</p>
              <p className="text-white/40 text-xs mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Location display */}
        {currentLocation ? (
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-4 h-4 text-primary-400" />
              <h3 className="text-white font-semibold text-sm">Current Location</h3>
              {isTracking && <div className="ml-auto w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
            </div>
            <div className="bg-dark-900/60 rounded-xl p-3 font-mono text-sm">
              <div className="flex justify-between text-white/60">
                <span>Latitude</span>
                <span className="text-white">{currentLocation.lat.toFixed(6)}°</span>
              </div>
              <div className="flex justify-between text-white/60 mt-1">
                <span>Longitude</span>
                <span className="text-white">{currentLocation.lng.toFixed(6)}°</span>
              </div>
            </div>
            {/* Simple route visualization */}
            <div className="mt-3 h-32 rounded-xl bg-dark-900/80 border border-white/10 flex items-center justify-center overflow-hidden relative">
              {routePath.length > 1 ? (
                <RouteSVG path={routePath} />
              ) : (
                <div className="text-center">
                  <MapPin className="w-8 h-8 text-primary-400 mx-auto mb-1" />
                  <p className="text-white/30 text-xs">Route will appear here</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="glass-card p-6 text-center">
            <MapPin className="w-10 h-10 text-white/20 mx-auto mb-2" />
            <p className="text-white/40 text-sm">Start tracking to see your location</p>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <div>
              <p className="text-red-400 font-semibold text-sm">GPS Error</p>
              <p className="text-red-400/70 text-xs">{error}</p>
            </div>
          </div>
        )}

        {/* Route points count */}
        {routePath.length > 0 && (
          <div className="glass-card p-4 flex items-center gap-3">
            <Zap className="w-5 h-5 text-amber-400" />
            <div>
              <p className="text-white font-semibold text-sm">{routePath.length} GPS Points Recorded</p>
              <p className="text-white/40 text-xs">Route data is being synced to server</p>
            </div>
          </div>
        )}
      </div>
    </EmployeeLayout>
  );
}

function RouteSVG({ path }) {
  if (path.length < 2) return null;
  const lats = path.map(p => p.lat);
  const lngs = path.map(p => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const w = 300, h = 120, pad = 10;
  const toX = (lng) => pad + (maxLng === minLng ? w / 2 : ((lng - minLng) / (maxLng - minLng)) * (w - 2 * pad));
  const toY = (lat) => h - pad - (maxLat === minLat ? h / 2 : ((lat - minLat) / (maxLat - minLat)) * (h - 2 * pad));
  const points = path.map(p => `${toX(p.lng)},${toY(p.lat)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      <polyline points={points} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
      {/* Current position dot */}
      <circle cx={toX(path[path.length - 1].lng)} cy={toY(path[path.length - 1].lat)} r="5" fill="#22c55e" />
      <circle cx={toX(path[path.length - 1].lng)} cy={toY(path[path.length - 1].lat)} r="9" fill="none" stroke="#22c55e" strokeWidth="1.5" opacity="0.5" />
    </svg>
  );
}
