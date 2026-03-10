import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react'
import { AppState, MobileTab, Theme } from '@types'

interface AppActions {
  navigate: (route: string) => void
  toggleSidebar: () => void
  toggleRightPanel: () => void
  setMobileTab: (tab: MobileTab) => void
  setTheme: (theme: Theme) => void
}

interface AppStateContextValue extends AppState {
  actions: AppActions
}

const AppStateContext = createContext<AppStateContextValue | undefined>(undefined)

interface AppStateProviderProps {
  children: ReactNode
}

const DEFAULT_STATE: AppState = {
  currentRoute: '/chat',
  sidebarOpen: true,
  rightPanelOpen: false,
  mobileTab: 'chat',
  theme: 'dark'
}

export function AppStateProvider({ children }: AppStateProviderProps) {
  // Load theme from localStorage on mount
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('zeroclaw-theme')
    return (saved as Theme) || DEFAULT_STATE.theme
  })

  const [currentRoute, setCurrentRoute] = useState(DEFAULT_STATE.currentRoute)
  const [sidebarOpen, setSidebarOpen] = useState(DEFAULT_STATE.sidebarOpen)
  const [rightPanelOpen, setRightPanelOpen] = useState(DEFAULT_STATE.rightPanelOpen)
  const [mobileTab, setMobileTabState] = useState(DEFAULT_STATE.mobileTab)

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('zeroclaw-theme', theme)
  }, [theme])

  // Handle responsive sidebar
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setSidebarOpen(false)
        setRightPanelOpen(false)
      } else {
        setSidebarOpen(true)
      }
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const actions: AppActions = {
    navigate: useCallback((route: string) => {
      setCurrentRoute(route)
    }, []),

    toggleSidebar: useCallback(() => {
      setSidebarOpen(prev => !prev)
    }, []),

    toggleRightPanel: useCallback(() => {
      setRightPanelOpen(prev => !prev)
    }, []),

    setMobileTab: useCallback((tab: MobileTab) => {
      setMobileTabState(tab)
    }, []),

    setTheme: useCallback((newTheme: Theme) => {
      setThemeState(newTheme)
    }, [])
  }

  const value: AppStateContextValue = {
    currentRoute,
    sidebarOpen,
    rightPanelOpen,
    mobileTab,
    theme,
    actions
  }

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  )
}

export function useAppState() {
  const context = useContext(AppStateContext)
  if (context === undefined) {
    throw new Error('useAppState must be used within an AppStateProvider')
  }
  return context
}
