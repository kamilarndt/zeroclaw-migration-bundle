import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import RightPanel from '@/components/layout/RightPanel';

export default function Layout() {
  const [rightPanelOpen, setRightPanelOpen] = useState(true);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Fixed left sidebar */}
      <Sidebar />

      {/* Main area - three column layout */}
      <div className="ml-60 mr-80 flex flex-col min-h-screen">
        <Header onToggleRightPanel={() => setRightPanelOpen(!rightPanelOpen)} />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Fixed right sidebar - Tasks, Chat, Details */}
      {rightPanelOpen && <RightPanel onClose={() => setRightPanelOpen(false)} />}
    </div>
  );
}
