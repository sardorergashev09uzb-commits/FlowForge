import React, { useState, useEffect } from 'react';
import { api, getStoredToken, setStoredToken } from './lib/api';
import { useAppStore } from './store/useAppStore';
import { AuthScreen } from './components/auth/AuthScreen';
import { AppShell } from './components/layout/AppShell';

export const App: React.FC = () => {
  const [initializing, setInitializing] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const setBootstrapData = useAppStore((s) => s.setBootstrapData);

  const checkSession = async () => {
    const token = getStoredToken();
    if (!token) {
      setIsAuthenticated(false);
      setInitializing(false);
      return;
    }

    try {
      const boot = await api.bootstrap();
      setBootstrapData(boot);
      setIsAuthenticated(true);
    } catch {
      setStoredToken(null);
      setIsAuthenticated(false);
    } finally {
      setInitializing(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  if (initializing) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">
        FlowForge Enterprise yuklanmoqda...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen onAuthenticated={checkSession} />;
  }

  return <AppShell onLogout={() => setIsAuthenticated(false)} />;
};

export default App;
