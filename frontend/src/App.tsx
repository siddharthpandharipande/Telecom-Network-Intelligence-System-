import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { AmbientGlow } from './components/common/AmbientGlow';
import { OfflineBanner } from './components/common/OfflineBanner';
import { NocChatbot } from './components/common/NocChatbot';
import { useApiStatus } from './api/hooks';

// The 4 Core Pages
import { CommandCenter } from './pages/CommandCenter';
import { NetworkMap } from './pages/NetworkMap';
import { NetworkTrends } from './pages/NetworkTrends';
import { AnalyzeTelemetry } from './pages/AnalyzeTelemetry';

const AnimatedRoutes: React.FC = () => {
  const location = useLocation();

  return (
    <div key={location.pathname} className="w-full animate-page-transition">
      <Routes location={location}>
        <Route path="/" element={<CommandCenter />} />
        <Route path="/command-center" element={<CommandCenter />} />
        <Route path="/network-map" element={<NetworkMap />} />
        <Route path="/network-trends" element={<NetworkTrends />} />
        <Route path="/analyze-telemetry" element={<AnalyzeTelemetry />} />
        <Route path="/asset-investigation" element={<Navigate to="/" replace />} />
        <Route path="/asset-investigation/:id" element={<Navigate to="/" replace />} />
        <Route path="/asset-detail" element={<Navigate to="/" replace />} />
        <Route path="/asset-detail/:id" element={<Navigate to="/" replace />} />
        <Route path="/assets/:id" element={<Navigate to="/" replace />} />
        <Route path="*" element={<CommandCenter />} />
      </Routes>
    </div>
  );
};

export const App: React.FC = () => {
  const { isOnline, checkHealth, isChecking } = useApiStatus();

  return (
    <Router>
      <div className="min-h-screen bg-[#FAF9FF] text-slate-900 font-sans relative flex flex-col selection:bg-purple-100 selection:text-purple-900">
        {/* Ambient Ethereal Glows (Averon Visual DNA) */}
        <AmbientGlow />

        {/* API Offline Banner */}
        <OfflineBanner isOnline={isOnline} onRetry={checkHealth} isChecking={isChecking} />

        {/* Sticky Top Navigation Header */}
        <Header isOnline={isOnline} />

        {/* Main Workspace Area with smooth transitions */}
        <main className="flex-1 w-full max-w-[1440px] mx-auto px-6 py-10 relative z-10">
          <AnimatedRoutes />
        </main>

        {/* Global Gemini-Powered NOC Assistant Chatbot */}
        <NocChatbot />

        {/* Averon SaaS Footer */}
        <Footer />
      </div>
    </Router>
  );
};

export default App;
