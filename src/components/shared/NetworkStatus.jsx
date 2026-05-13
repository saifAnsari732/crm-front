import React, { useState, useEffect } from 'react';
import { WifiOff, AlertTriangle, Signal } from 'lucide-react';
import { networkMonitor } from '../../utils/networkMonitor';
import { isSocketConnected } from '../../services/socket.service';

export default function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [socketConnected, setSocketConnected] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const unsubscribe = networkMonitor.subscribe((online) => {
      setIsOnline(online);
      setShow(!online);
      if (online) {
        setTimeout(() => setShow(false), 3000);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const checkSocket = () => {
      setSocketConnected(isSocketConnected());
    };
    checkSocket();
    const interval = setInterval(checkSocket, 2000);
    return () => clearInterval(interval);
  }, []);

  if (!show && isOnline && socketConnected) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
      {/* Internet Status */}
      {!isOnline && (
        <div className="bg-red-600 text-white px-4 py-2 flex items-center gap-2 justify-center animate-in fade-in border-b border-red-700">
          <WifiOff className="w-4 h-4" />
          <span className="text-sm font-medium">No internet connection</span>
        </div>
      )}

      {/* Socket Disconnected - Removed as requested */}
      {/* 
      {isOnline && !socketConnected && (
        <div className="bg-teal-800 text-white px-4 py-2 flex items-center gap-2 justify-center animate-in fade-in border-b border-amber-700">
          <span className="text-sm font-medium">Connecting to server...</span>
        </div>
      )}
      */}

      {/* Connected */}
      {isOnline && socketConnected && show && (
        <div className="bg-green-600 text-white px-4 py-2 flex items-center gap-2 justify-center animate-in fade-in border-b border-green-700">
          <Signal className="w-4 h-4" />
          <span className="text-sm font-medium">Connection restored</span>
        </div>
      )}
    </div>
  );
}
