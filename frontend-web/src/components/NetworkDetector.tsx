import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, AlertTriangle } from 'lucide-react';

interface NetworkDetectorProps {
  children: React.ReactNode;
}

const NetworkDetector = React.memo(({ children }: NetworkDetectorProps) => {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [wasOffline, setWasOffline] = useState<boolean>(false);
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    // Initial check
    setIsOnline(navigator.onLine);

    // Event listeners for online/offline
    let timerId: ReturnType<typeof setTimeout>;
    const handleOnline = () => {
      setIsOnline(true);
      setWasOffline(true);
      // Clear offline flag after 5 seconds
      timerId = setTimeout(() => setWasOffline(false), 5000);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic connectivity check with latency
    const checkConnectivity = async () => {
      const start = performance.now();
      try {
        // Use a HEAD request to a lightweight endpoint
        const response = await fetch(window.location.origin + '/', {
          method: 'HEAD',
          cache: 'no-store',
          signal: AbortSignal.timeout(5000)
        });
        
        if (response.ok) {
          const end = performance.now();
          setLatency(Math.round(end - start));
          setIsOnline(true);
        } else {
          setIsOnline(false);
        }
      } catch (error) {
        setLatency(null);
        setIsOnline(false);
      }
    };

    // Check every 30 seconds
    const intervalId = setInterval(checkConnectivity, 30000);

    // Initial check
    checkConnectivity();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(intervalId);
      if (timerId) clearTimeout(timerId);
    };
  }, []);

  const getLatencyColor = (ms: number | null): string => {
    if (ms === null) return 'text-gray-500';
    if (ms < 100) return 'text-green-400';
    if (ms < 300) return 'text-yellow-400';
    return 'text-red-400';
  };

  if (isOnline) {
    return (
      <>
        {children}
        {/* Online indicator */}
        <div className="fixed top-20 right-4 z-50 flex items-center gap-2 bg-green-500/10 backdrop-blur-sm rounded-lg p-3 border border-green-500/20">
          <Wifi size={20} className="text-green-400" />
          <div className="text-sm">
            <span className="text-green-400 font-semibold">Online</span>
            {latency !== null && (
              <span className={`ml-2 ${getLatencyColor(latency)}`}>
                {latency}ms
              </span>
            )}
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm">
      <div className="text-center p-8 max-w-md">
        <div className="mb-6">
          <WifiOff size={64} className="mx-auto text-red-400 animate-pulse" />
        </div>
        
        <h2 className="text-2xl font-bold text-white mb-4">
          You're Offline
        </h2>
        
        <p className="text-gray-400 mb-6">
          Check your internet connection and try again. Some features may be unavailable while offline.
        </p>

        {wasOffline && (
          <div className="flex items-center gap-2 justify-center text-yellow-400 mb-4">
            <AlertTriangle size={20} />
            <span className="text-sm">
              Connection was restored but may be unstable
            </span>
          </div>
        )}

        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-white text-black rounded-lg font-semibold hover:bg-white/90 transition-colors"
        >
          Retry Connection
        </button>

        <div className="mt-6 text-sm text-gray-500">
          <p>Last checked: {new Date().toLocaleTimeString()}</p>
        </div>
      </div>
    </div>
  );
});

NetworkDetector.displayName = 'NetworkDetector';

export default NetworkDetector;
