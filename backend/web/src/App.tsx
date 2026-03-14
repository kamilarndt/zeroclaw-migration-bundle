import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import AgentChat from './pages/AgentChat';
import Tools from './pages/Tools';
import Cron from './pages/Cron';
import Integrations from './pages/Integrations';
import Memory from './pages/Memory';
import Config from './pages/Config';
import Cost from './pages/Cost';
import Logs from './pages/Logs';
import Doctor from './pages/Doctor';
import TelegramHub from './pages/TelegramHub';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { LocaleContext } from './contexts';
import { PairingDialog } from './components/auth';
import { setLocale, type Locale } from './lib/i18n';

function AppContent() {
  const { isAuthenticated, loading, pair, logout } = useAuth();
  const [locale, setLocaleState] = useState('tr');

  const setAppLocale = (newLocale: string) => {
    setLocaleState(newLocale);
    setLocale(newLocale as Locale);
  };

  // Listen for 401 events to force logout
  useEffect(() => {
    const handler = () => {
      logout();
    };
    window.addEventListener('zeroclaw-unauthorized', handler);
    return () => window.removeEventListener('zeroclaw-unauthorized', handler);
  }, [logout]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400">Connecting...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <PairingDialog onPair={pair} />;
  }

  return (
    <LocaleContext.Provider value={{ locale, setAppLocale }}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/agent" element={<AgentChat />} />
          <Route path="/tools" element={<Tools />} />
          <Route path="/cron" element={<Cron />} />
          <Route path="/integrations" element={<Integrations />} />
          <Route path="/memory" element={<Memory />} />
          <Route path="/config" element={<Config />} />
          <Route path="/cost" element={<Cost />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/doctor" element={<Doctor />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </LocaleContext.Provider>
  );
}

export default function App() {
  return (
    <Routes>
      {/* TMA Hub - outside AuthProvider, uses Telegram initData */}
      <Route path="/tma/hub" element={<TelegramHub />} />

      {/* Main app - requires JWT auth */}
      <Route
        path="*"
        element={
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        }
      />
    </Routes>
  );
}
