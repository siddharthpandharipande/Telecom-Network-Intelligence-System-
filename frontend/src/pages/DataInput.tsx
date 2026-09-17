import React from 'react';
import { Database, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';
import { CompanyDataInputPanel } from '../components/ingestion/CompanyDataInputPanel';

export const DataInput: React.FC = () => {
  return (
    <div className="p-6 space-y-6 font-mono">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-cyan-400 font-bold uppercase tracking-widest">
            <Database size={16} />
            <span>COMPANY NETWORK TELEMETRY SOURCE</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight mt-1">
            Company Network Data Ingestion Hub
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Input company telemetry data via manual entry or bulk CSV upload to power SVM Risk Prediction, DBSCAN Anomaly Detection, Network Health, and the Live Interactive Map.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-full bg-cyan-500/15 border border-cyan-400/40 text-cyan-300 text-xs font-bold flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-cyan-400" />
            <span>SOURCE OF TRUTH ACTIVE</span>
          </div>
        </div>
      </div>

      {/* Prominent Company Data Input Component */}
      <CompanyDataInputPanel />
    </div>
  );
};
