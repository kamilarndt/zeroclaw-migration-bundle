// web/src/components/NetworkStatus.tsx
import React from 'react'
import { useNetworkStatus } from '@hooks/useNetworkStatus'
import { Wifi, WifiOff, AlertTriangle } from 'lucide-react'

export function NetworkStatus() {
  const status = useNetworkStatus()

  if (status.isOnline) {
    return null // Don't show banner when online
  }

  return (
    <div className="flex items-center justify-center px-4 py-2 bg-red-900/80 backdrop-blur-sm border-b border-red-700">
      <WifiOff size={16} className="text-red-300 mr-2" />
      <span className="text-sm text-red-200">
        You are offline. Changes will be saved locally.
      </span>
      {status.effectiveType && (
        <span className="ml-2 text-xs text-red-400">
          ({status.effectiveType})
        </span>
      )}
    </div>
  )
}

export function NetworkStatusIndicator() {
  const status = useNetworkStatus()

  return (
    <div className="flex items-center gap-2 px-2 py-1" data-testid="network-status-indicator">
      {status.isOnline ? (
        <>
          <Wifi size={14} className="text-green-400" />
          <span className="text-xs text-gray-400">Online</span>
        </>
      ) : (
        <>
          <WifiOff size={14} className="text-red-400" />
          <span className="text-xs text-gray-400">Offline</span>
        </>
      )}
    </div>
  )
}
