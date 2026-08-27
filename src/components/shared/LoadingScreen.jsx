import React from 'react';

export default function LoadingScreen() {
  return (
    <div className="min-h-screen mesh-bg flex items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-2xl bg-primary-600/30 animate-ping" />
          <div className="relative w-16 h-16 rounded-2xl bg-white overflow-hidden shadow-glow p-2"><img src="/images/kisanLogo.jpg" alt="Logo" className="w-full h-full object-contain" /></div>
        </div>
        <div className="flex gap-1.5">
          {[0,1,2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
        <p className="text-white/40 text-sm font-medium tracking-widest uppercase">Kisanteam CRM</p>
      </div>
    </div>
  );
}
