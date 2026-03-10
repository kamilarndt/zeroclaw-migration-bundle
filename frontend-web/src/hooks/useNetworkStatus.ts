// web/src/hooks/useNetworkStatus.ts
import { useState, useEffect, useCallback } from 'react'

export interface NetworkStatus {
  isOnline: boolean
  effectiveType?: string
  saveData: boolean
  lastChanged: Date | null
}

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator !== 'undefined') {
      return navigator.onLine
    }
    return true
  })

  const [effectiveType, setEffectiveType] = useState<string | undefined>(undefined)
  const [saveData, setSaveData] = useState<boolean>(false)
  const [lastChanged, setLastChanged] = useState<Date | null>(new Date())

  const handleOnline = useCallback(() => {
    setIsOnline(true)
    setLastChanged(new Date())
    console.log('[useNetworkStatus] Network is online')
  }, [])

  const handleOffline = useCallback(() => {
    setIsOnline(false)
    setLastChanged(new Date())
    console.log('[useNetworkStatus] Network is offline')
  }, [])

  useEffect(() => {
    // Set initial effective connection type if available
    if ('connection' in navigator && (navigator as any).connection) {
      const connection = (navigator as any).connection
      setEffectiveType(connection.effectiveType)
      setSaveData(connection.saveData)

      const handleConnectionChange = () => {
        setEffectiveType(connection.effectiveType)
        setSaveData(connection.saveData)
        console.log('[useNetworkStatus] Connection changed:', {
          effectiveType: connection.effectiveType,
          saveData: connection.saveData,
          downlink: connection.downlink,
          rtt: connection.rtt
        })
      }

      connection.addEventListener('change', handleConnectionChange)

      return () => {
        connection.removeEventListener('change', handleConnectionChange)
      }
    }
  }, [])

  useEffect(() => {
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [handleOnline, handleOffline])

  const status: NetworkStatus = {
    isOnline,
    effectiveType,
    saveData,
    lastChanged
  }

  return status
}
