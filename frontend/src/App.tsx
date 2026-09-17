import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { TelemetryProvider } from './context/TelemetryContext';
import { Sidebar } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { NetworkSummaryHeader } from './components/layout/NetworkSummaryHeader';
import { WorkflowStepper } from './components/layout/WorkflowStepper';

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

export const App: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  return (
    <TelemetryProvider>
      <Router>
        <div className="min-h-screen bg-[#060911] text-slate-100 flex flex-col antialiased">
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
            {/* Global NOC Summary Header */}
            <NetworkSummaryHeader />

            {/* Interactive Workflow Progress Stepper */}
            <WorkflowStepper />

            {/* Application Page Router */}
            <div className="w-full">
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
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </div>
          </main>
        </div>
      </Router>
    </TelemetryProvider>
  );
};

export default App;
