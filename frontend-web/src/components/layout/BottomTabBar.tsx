import { NavLink, useLocation } from 'react-router-dom'
import {
  MessageSquare,
  ClipboardList,
  ChartBar,
  Cpu
} from 'lucide-react'
import { useAppState } from '@contexts/AppStateContext'

interface NavItem {
  name: string
  path: string
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
}

const MOBILE_ITEMS: NavItem[] = [
  { name: 'Chat', path: '/chat', icon: MessageSquare },
  { name: 'Tasks', path: '/tasks', icon: ClipboardList },
  { name: 'Dashboard', path: '/dashboard', icon: ChartBar },
  { name: 'Hands', path: '/hands', icon: Cpu }
]

export function BottomTabBar() {
  const location = useLocation()
  const { mobileTab } = useAppState()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 w-full h-16 bg-neutral-950/90 backdrop-blur-xl border-t border-neutral-800 z-50 flex items-center justify-around px-2" data-testid="bottom-navigation">
      {MOBILE_ITEMS.map((item) => {
        const Icon = item.icon
        const isActive = location.pathname === item.path

        return (
          <NavLink
            key={item.path}
            to={item.path}
            className="flex flex-col items-center justify-center w-16 h-full relative group"
          >
            {isActive && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-white rounded-b-full shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
            )}
            <Icon className={`w-5 h-5 mb-1 transition-all duration-200 ${
              isActive ? 'text-white scale-110' : 'text-neutral-500'
            }`} strokeWidth={isActive ? 2 : 1.5} />
            <span className={`text-[9px] font-medium transition-colors ${
              isActive ? 'text-white' : 'text-neutral-500'
            }`}>
              {item.name}
            </span>
          </NavLink>
        )
      })}
    </nav>
  )
}
