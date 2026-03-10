import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import { Hands } from './pages/Hands';
import { Memory } from './pages/Memory';
import { SOPs } from './pages/SOPs';
import { Config } from './pages/Config';
import { AgentChat } from './pages/AgentChat';
import { NotificationProvider } from './components/NotificationProvider';
import NetworkDetector from './components/NetworkDetector';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppStateProvider } from './contexts/AppStateContext';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { PairingDialog } from './components/auth';
import { TaskStoreInitializer } from './components/TaskStoreInitializer';

function AppContent() {
  const { isAuthenticated, loading, pair, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <PairingDialog onPair={pair} />;
  }

  return (
    <ErrorBoundary>
      <NetworkDetector>
        <NotificationProvider>
          <AppStateProvider>
            <WebSocketProvider>
              <TaskStoreInitializer>
                <Router>
                  <Layout>
                    <Routes>
                      <Route path="/" element={<Navigate to="/dashboard" replace />} />
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/tasks" element={<Tasks />} />
                      <Route path="/hands" element={<Hands />} />
                      <Route path="/memory" element={<Memory />} />
                      <Route path="/sops" element={<SOPs />} />
                      <Route path="/config" element={<Config />} />
                      <Route path="/chat" element={<AgentChat />} />
                    </Routes>
                  </Layout>
                </Router>
              </TaskStoreInitializer>
            </WebSocketProvider>
          </AppStateProvider>
        </NotificationProvider>
      </NetworkDetector>
    </ErrorBoundary>
  );
}

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
