import { ReactNode } from 'react'
import { Outlet } from 'react-router-dom'
import { useAppState } from '@contexts/AppStateContext'
import { useIsMobile } from '@hooks/useBreakpoint'
import Sidebar from './Sidebar'
import { BottomTabBar } from './BottomTabBar'
import { NetworkStatus, NetworkStatusIndicator } from '../NetworkStatus'

interface LayoutProps {
  children?: ReactNode
}

export function Layout({ children }: LayoutProps) {
  const { sidebarOpen, rightPanelOpen, actions } = useAppState()
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <div className="flex flex-col h-screen bg-neutral-950 text-neutral-50">
        {/* Ambient glow for mobile */}
        <div className="ambient-glow" />

        {/* Main Content Area */}
        <main className="flex-1 overflow-hidden relative z-10">
          {children || <Outlet />}
        </main>

        {/* Bottom Tab Bar */}
        <BottomTabBar />
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-neutral-950 text-neutral-50">
      {/* Ambient glow for desktop */}
      <div className="ambient-glow" />

      {/* Network Status Banner */}
      <NetworkStatus />

      {/* Network Status Indicator (always visible) */}
      <div className="fixed top-2 right-2 z-10">
        <NetworkStatusIndicator />
      </div>

      {/* Left Sidebar - Navigation */}
      <aside
        data-testid="sidebar-navigation"
        className={`
          flex-shrink-0 transition-all duration-300 ease-in-out relative z-10
          ${sidebarOpen ? 'w-60' : 'w-0'}
          bg-neutral-950 border-r border-neutral-800
          overflow-hidden
        `}
      >
        <Sidebar isOpen={sidebarOpen} onToggle={actions.toggleSidebar} />
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto relative z-10">
        {children || <Outlet />}
      </main>

      {/* Right Sidebar - Details/Context */}
      <aside
        className={`
          flex-shrink-0 transition-all duration-300 ease-in-out relative z-10
          ${rightPanelOpen ? 'w-80' : 'w-0'}
          bg-neutral-950 border-l border-neutral-800
          overflow-hidden
        `}
      >
        <div className="p-4">
          <h3 className="text-sm font-semibold text-neutral-400 mb-4">Details</h3>
          <p className="text-sm text-neutral-500">Right panel content</p>
        </div>
      </aside>
    </div>
  )
}
