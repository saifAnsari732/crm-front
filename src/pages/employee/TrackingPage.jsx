import React, { useEffect, useState } from 'react';
import EmployeeLayout from '../../components/layout/EmployeeLayout';
import { useTracking } from '../../contexts/TrackingContext';
import { MapPin, Navigation, Clock, Zap, Activity, AlertCircle, CheckCircle, ClipboardList, Locate, ChevronRight, Train, Bus, Plus, Image as ImageIcon, Loader2, X } from 'lucide-react';
import { uploadAPI, travelAPI } from '../../services/api.service';

import toast from 'react-hot-toast';

export default function TrackingPage() {
  const { isTracking, currentLocation, currentAddress, totalDistance, currentSpeed, routePath, error, toggleTracking } = useTracking();
  const [elapsed, setElapsed] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [copying, setCopying] = useState(false);
  const [showTravelModal, setShowTravelModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [travelForm, setTravelForm] = useState({ type: 'bus', source: '', destination: '', ticketUrl: '' });
  const [submitting, setSubmitting] = useState(false);


  useEffect(() => {
    if (isTracking && !startTime) setStartTime(Date.now());
    if (!isTracking) { setStartTime(null); setElapsed(0); }
  }, [isTracking, startTime]);

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

  const handleCopyAddress = () => {
    if (!currentAddress) return;
    navigator.clipboard.writeText(currentAddress);
    setCopying(true);
    toast.success('Address copied to clipboard!');
    setTimeout(() => setCopying(false), 2000);
  };

  const openInGoogleMaps = () => {
    if (!currentLocation) return;
    window.open(`https://www.google.com/maps/search/?api=1&query=${currentLocation.lat},${currentLocation.lng}`, '_blank');
  };

  const handleTicketUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const { data } = await uploadAPI.uploadImage(formData);
      setTravelForm(p => ({ ...p, ticketUrl: data.url }));
      toast.success('Ticket uploaded');
    } catch { toast.error('Upload failed'); }
    finally { setUploading(false); }
  };

  const handleTravelSubmit = async (e) => {
    e.preventDefault();
    if (!travelForm.ticketUrl) return toast.error('Please upload ticket photo');
    setSubmitting(true);
    try {
      await travelAPI.create(travelForm);
      toast.success('Travel logged successfully');
      setShowTravelModal(false);
      setTravelForm({ type: 'bus', source: '', destination: '', ticketUrl: '' });
    } catch { toast.error('Failed to log travel'); }
    finally { setSubmitting(false); }
  };

  return (
    <EmployeeLayout>
      <div className="p-4 lg:p-6 space-y-6 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[var(--text-main)] text-2xl font-bold">Live Tracking</h1>
            <p className="text-[var(--text-muted)] text-sm">Monitor your field activity in real-time</p>
          </div>
          {isTracking && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </div>
          )}
          <button onClick={() => setShowTravelModal(true)} className="btn-secondary py-1.5 px-4 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
             <Train className="w-3.5 h-3.5" /> Public Transport
          </button>
        </div>

        {/* Big Toggle Button */}
        <div className="flex flex-col items-center py-4">
          <div className="relative">
            {isTracking && (
              <>
                <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping scale-125" />
                <div className="absolute inset-0 rounded-full bg-emerald-500/10 animate-ping scale-150" style={{ animationDelay: '0.3s' }} />
              </>
            )}
            <button
              onClick={toggleTracking}
              className={`relative w-32 h-32 rounded-full border-4 transition-all duration-500 flex flex-col items-center justify-center gap-1 font-bold text-lg active:scale-95
                ${isTracking
                  ? 'bg-emerald-600 border-emerald-400 text-white shadow-glow-green'
                  : 'bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-main)] hover:bg-[var(--bg-card-hover)] shadow-xl'
                }`}>
              {isTracking ? (
                <>
                  <div className="w-5 h-5 rounded-sm bg-white mb-1" />
                  <span className="text-[10px] font-black tracking-[0.2em] uppercase">STOP</span>
                </>
              ) : (
                <>
                  <Navigation className="w-8 h-8 mb-1" />
                  <span className="text-[10px] font-black tracking-[0.2em] uppercase">START</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Distance', value: `${totalDistance.toFixed(2)} km`, icon: Navigation, color: 'text-blue-400' },
            { label: 'Speed', value: `${currentSpeed} km/h`, icon: Activity, color: 'text-violet-400' },
            { label: 'Time', value: isTracking ? formatTime(elapsed) : '00:00:00', icon: Clock, color: 'text-amber-400' },
          ].map((s, i) => (
            <div key={i} className="glass-card p-4 text-center border-[var(--border-color)] bg-[var(--bg-card)]">
              <s.icon className={`w-4 h-4 ${s.color} mx-auto mb-2`} />
              <p className={`font-black text-sm tracking-tight ${isTracking ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)] opacity-60'}`}>{s.value}</p>
              <p className="text-[var(--text-muted)] text-[9px] font-bold uppercase tracking-widest mt-1 opacity-70">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Location display */}
        {currentLocation ? (
          <div className="glass-card p-5 border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary-500" />
                <h3 className="text-[var(--text-main)] font-bold text-xs uppercase tracking-wider">Current GPS Status</h3>
              </div>
              <button 
                onClick={openInGoogleMaps}
                className="text-primary-400 text-[10px] font-bold flex items-center gap-1 hover:text-primary-300 transition-colors"
              >
                Google Maps <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[var(--bg-main)]/50 border border-[var(--border-color)] rounded-2xl p-3">
                <p className="text-[var(--text-muted)] text-[9px] font-bold uppercase tracking-widest mb-1 opacity-70">Latitude</p>
                <p className="text-[var(--text-main)] font-mono text-xs font-bold">{currentLocation.lat.toFixed(6)}</p>
              </div>
              <div className="bg-[var(--bg-main)]/50 border border-[var(--border-color)] rounded-2xl p-3">
                <p className="text-[var(--text-muted)] text-[9px] font-bold uppercase tracking-widest mb-1 opacity-70">Longitude</p>
                <p className="text-[var(--text-main)] font-mono text-xs font-bold">{currentLocation.lng.toFixed(6)}</p>
              </div>
            </div>
            
            {/* Detailed Address Display */}
            <div className="relative group p-5 rounded-[1.5rem] bg-gradient-to-br from-primary-600/20 to-violet-600/10 border border-primary-500/30 overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 p-3">
                <button 
                  onClick={handleCopyAddress}
                  className={`p-2 rounded-xl border transition-all active:scale-90 ${
                    copying 
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' 
                      : 'bg-white/5 border-white/10 text-white/40 hover:text-white hover:bg-white/10'
                  }`}
                  title="Copy Address"
                >
                  {copying ? <CheckCircle className="w-3.5 h-3.5" /> : <ClipboardList className="w-3.5 h-3.5" />}
                </button>
              </div>
              
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-primary-500/20 flex items-center justify-center">
                  <Locate className="w-4 h-4 text-primary-500" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-500">Actual Address</p>
              </div>

              <p className="text-[var(--text-main)] text-sm font-bold leading-relaxed pr-8">
                {currentAddress || 'Resolving professional address...'}
              </p>
            </div>

            {/* Simple route visualization */}
            <div className="mt-4 h-36 rounded-2xl bg-[var(--bg-main)]/50 border border-[var(--border-color)] flex items-center justify-center overflow-hidden relative shadow-inner">
              {routePath.length > 1 ? (
                <RouteSVG path={routePath} />
              ) : (
                <div className="text-center">
                  <Navigation className="w-6 h-6 text-primary-500/30 mx-auto mb-2" />
                  <p className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-widest opacity-30">Live Route Preview</p>
                </div>
              )}
              {isTracking && (
                <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/40 backdrop-blur-md border border-white/10">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-white/60 text-[9px] font-bold uppercase tracking-tighter">Syncing</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="glass-card p-10 text-center border-white/5">
            <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center mx-auto mb-4 border border-white/10">
              <MapPin className="w-8 h-8 text-white/20" />
            </div>
            <p className="text-white/40 text-sm font-bold uppercase tracking-widest">Start tracking to see GPS data</p>
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

        {/* Travel Modal */}
        {showTravelModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
             <div className="glass-card w-full max-w-md p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                   <h2 className="text-lg font-bold text-[var(--text-main)] uppercase tracking-tight flex items-center gap-2">
                      <Train className="w-5 h-5 text-primary-500" /> Log Public Travel
                   </h2>
                   <button onClick={() => setShowTravelModal(false)} className="p-2 rounded-xl hover:bg-white/5"><X className="w-5 h-5 text-[var(--text-muted)]" /></button>
                </div>
                <form onSubmit={handleTravelSubmit} className="space-y-4">
                   <div className="flex gap-2">
                      {['bus', 'train'].map(t => (
                        <button key={t} type="button" onClick={() => setTravelForm(p => ({ ...p, type: t }))}
                          className={`flex-1 py-2 rounded-xl border flex items-center justify-center gap-2 font-bold uppercase text-[10px] tracking-widest transition-all ${
                            travelForm.type === t ? 'bg-primary-600 border-primary-500 text-white' : 'bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-muted)]'
                          }`}>
                          {t === 'bus' ? <Bus className="w-4 h-4" /> : <Train className="w-4 h-4" />} {t}
                        </button>
                      ))}
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase mb-1.5">Source</label>
                        <input className="input-field" required value={travelForm.source} onChange={e => setTravelForm(p => ({ ...p, source: e.target.value }))} placeholder="From station..." />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase mb-1.5">Destination</label>
                        <input className="input-field" required value={travelForm.destination} onChange={e => setTravelForm(p => ({ ...p, destination: e.target.value }))} placeholder="To station..." />
                      </div>
                   </div>
                   <div>
                      <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase mb-1.5">Ticket Photo</label>
                      {travelForm.ticketUrl ? (
                        <div className="relative rounded-2xl overflow-hidden border-2 border-primary-500/30 h-40 group">
                           <img src={travelForm.ticketUrl} className="w-full h-full object-cover" alt="Ticket" />
                           <button type="button" onClick={() => setTravelForm(p => ({ ...p, ticketUrl: '' }))} className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                              <X className="w-4 h-4" />
                           </button>
                        </div>
                      ) : (
                        <label className="h-40 rounded-2xl border-2 border-dashed border-[var(--border-color)] flex flex-col items-center justify-center cursor-pointer hover:border-primary-500 transition-all hover:bg-primary-500/5">
                           {uploading ? <Loader2 className="w-8 h-8 animate-spin text-primary-500" /> : <><Plus className="w-8 h-8 text-[var(--text-muted)] mb-2" /><span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Upload Ticket</span></>}
                           <input type="file" className="hidden" accept="image/*" onChange={handleTicketUpload} disabled={uploading} />
                        </label>
                      )}
                   </div>
                   <div className="flex gap-3 pt-2">
                      <button type="button" onClick={() => setShowTravelModal(false)} className="btn-secondary flex-1 py-4">Cancel</button>
                      <button type="submit" disabled={submitting || uploading} className="btn-primary flex-1 py-4 flex items-center justify-center gap-2">
                         {submitting ? 'Logging...' : 'Confirm Travel'}
                      </button>
                   </div>
                </form>
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
