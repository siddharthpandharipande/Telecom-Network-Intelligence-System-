import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { TelemetryProvider } from './context/TelemetryContext';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { Sidebar } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';

import { useApiStatus } from './api/hooks';
import { OfflineBanner } from './components/common/OfflineBanner';
import { AuthModal } from './components/common/AuthModal';

// Pages
import { Overview } from './pages/Overview';
import { DataInput } from './pages/DataInput';
import { NetworkHealth } from './pages/NetworkHealth';
import { LiveMap } from './pages/LiveMap';
import { SVMPrediction } from './pages/SVMPrediction';
import { DBSCANAnomaly } from './pages/DBSCANAnomaly';
import { AlertsIncidents } from './pages/AlertsIncidents';
import { NetworkAssets } from './pages/NetworkAssets';
import { Analytics } from './pages/Analytics';
import { Settings } from './pages/Settings';
import { ModelCardPage } from './pages/ModelCardPage';

export const App: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const { isOnline, checkHealth, isChecking } = useApiStatus();

  return (
    <ThemeProvider>
      <AuthProvider>
        <TelemetryProvider>
          <Router>
            <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex flex-col antialiased transition-colors duration-200">
              {/* Role-Based Authentication Modal */}
              <AuthModal />

              {/* Global API Offline Banner */}
              <OfflineBanner isOnline={isOnline} onRetry={checkHealth} isChecking={isChecking} />

            {/* Topbar Header */}
            <Topbar
              collapsed={sidebarCollapsed}
              toggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            />

            {/* Left Navigation Sidebar */}
            <Sidebar
              collapsed={sidebarCollapsed}
              toggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            />

            {/* Main Content Workspace Area */}
            <main
              className={`flex-1 transition-all duration-300 pt-16 ${
                sidebarCollapsed ? 'ml-20' : 'ml-64'
              }`}
            >
              {/* Application Page Router */}
              <div className="w-full min-h-[calc(100vh-4rem)]">
                <Routes>
                  <Route path="/" element={<Overview />} />
                  <Route path="/data-input" element={<DataInput />} />
                  <Route path="/health" element={<NetworkHealth />} />
                  <Route path="/map" element={<LiveMap />} />
                  <Route path="/svm" element={<SVMPrediction />} />
                  <Route path="/dbscan" element={<DBSCANAnomaly />} />
                  <Route path="/incidents" element={<AlertsIncidents />} />
                  <Route path="/assets" element={<NetworkAssets />} />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/model" element={<ModelCardPage />} />
                  <Route path="/settings" element={<Settings />} />
                </Routes>
              </div>
            </main>
          </div>
        </Router>
        </TelemetryProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;


