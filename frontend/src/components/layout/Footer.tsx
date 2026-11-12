import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-white/90 border-t border-slate-200/70 py-6 mt-auto relative z-10">
      <div className="max-w-[1440px] mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-medium text-slate-600">
            NEXUSNET Autonomous Architecture • Averon SaaS Design System
          </span>
        </div>
        <div>
          Demonstration Telemetry Interface • Prototype Version 2.0 (2026)
        </div>
      </div>
    </footer>
  );
};
