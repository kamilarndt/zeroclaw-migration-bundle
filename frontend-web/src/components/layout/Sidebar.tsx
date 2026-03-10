import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  CheckSquare, 
  Hand, 
  Database, 
  BookOpen, 
  Settings,
  MessageSquare,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', description: 'Overview and metrics' },
    { path: '/tasks', icon: CheckSquare, label: 'Tasks', description: 'Manage your tasks' },
    { path: '/hands', icon: Hand, label: 'Hands', description: 'Agent management' },
    { path: '/memory', icon: Database, label: 'Memory', description: 'Knowledge base' },
    { path: '/sops', icon: BookOpen, label: 'SOPs', description: 'Standard procedures' },
    { path: '/config', icon: Settings, label: 'Config', description: 'Settings and preferences' },
    { path: '/chat', icon: MessageSquare, label: 'Chat', description: 'Agent chat' },
  ];

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  const handleKeyDown = (e: React.KeyboardEvent, path: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleNavigate(path);
    }
  };

  return (
    <>
      {/* Sidebar */}
      <aside
        id="main-sidebar"
        className={`fixed left-0 top-0 h-full bg-black/90 backdrop-blur-lg border-r border-white/10 transition-all duration-300 z-40 ${
          isOpen ? 'w-64' : 'w-20'
        }`}
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            {isOpen && (
              <div>
                <h1 className="text-xl font-bold text-white">ZeroClaw</h1>
                <p className="text-xs text-gray-500">Dashboard</p>
              </div>
            )}
            <button
              onClick={onToggle}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onToggle();
                }
              }}
              className={`p-2 hover:bg-white/10 rounded-lg transition-colors ${
                isOpen ? 'ml-auto' : 'mx-auto'
              }`}
              aria-label={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              aria-expanded={isOpen}
            >
              {isOpen ? <ChevronLeft size={20} className="text-white" /> : <ChevronRight size={20} className="text-white" />}
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-2 overflow-y-auto" role="menu" aria-label="Main menu" data-testid="sidebar-menu">
            <ul className="space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;

                return (
                  <li key={item.path} role="none">
                    <button
                      onClick={() => handleNavigate(item.path)}
                      onKeyDown={(e) => handleKeyDown(e, item.path)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-white/10 text-white'
                          : 'text-gray-400 hover:bg-white/5 hover:text-white'
                      }`}
                      role="menuitem"
                      aria-current={isActive ? 'page' : undefined}
                      title={isOpen ? undefined : item.label}
                    >
                      <Icon size={20} className="flex-shrink-0" aria-hidden="true" />
                      {isOpen && (
                        <span className="flex-1 text-left text-sm font-medium">{item.label}</span>
                      )}
                      {/* Tooltip for collapsed state */}
                      {!isOpen && (
                        <span className="sr-only">{item.label}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-white/10">
            {isOpen && (
              <div className="text-xs text-gray-500">
                <p>ZeroClaw Dashboard</p>
                <p>v1.0.0</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={onToggle}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              onToggle();
            }
          }}
          aria-hidden="true"
        />
      )}
    </>
  );
};

export default Sidebar;
