import React from 'react';
import { Radio, Users, Gauge, AlertTriangle, ScatterChart, ShieldAlert, CheckCircle2, Cpu } from 'lucide-react';
import { useTelemetry } from '../../context/TelemetryContext';

export const NetworkSummaryHeader: React.FC = () => {
  const { incidents, alerts } = useTelemetry();

  const activeIncidents = incidents.filter(i => i.status !== 'RESOLVED').length;
  const activeAlerts = alerts.filter(a => a.status !== 'Resolved').length;

  const stats = [
    { label: 'Total Network Cells', value: '2,486', icon: <Radio size={16} className="text-cyan-400" />, trend: '+12 this week' },
    { label: 'Active Cells', value: '2,451', icon: <CheckCircle2 size={16} className="text-emerald-400" />, trend: '98.6% Online' },
    { label: 'Connected Users', value: '1.84M', icon: <Users size={16} className="text-blue-400" />, trend: '▲ 4.2% peak load' },
    { label: 'Network Load', value: '71.4%', icon: <Gauge size={16} className="text-amber-400" />, trend: 'Optimal threshold' },
    { label: 'AI Risk Cells', value: '27', icon: <Cpu size={16} className="text-purple-400" />, trend: 'SVM High Confidence' },
    { label: 'AI Anomalies', value: '14', icon: <ScatterChart size={16} className="text-indigo-400" />, trend: 'DBSCAN Outliers' },
    { label: 'Active Alerts', value: `${activeAlerts}`, icon: <AlertTriangle size={16} className="text-amber-400" />, trend: 'Telemetry Monitor' },
    { label: 'Critical Incidents', value: `${activeIncidents}`, icon: <ShieldAlert size={16} className="text-red-400" />, trend: 'Immediate NOC Action' },
  ];

  return (
    <div className="w-full bg-[#0c1322]/90 border-b border-[#1e2d4a] px-6 py-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
        {stats.map((stat, idx) => (
          <div
            key={idx}
            className="flex flex-col p-2.5 rounded-lg bg-[#111b30]/80 border border-[#1e2d4a] hover:border-cyan-500/40 transition-all shadow-sm"
          >
            <div className="flex items-center justify-between text-slate-400 text-[10px] font-mono tracking-tight mb-1">
              <span className="truncate">{stat.label}</span>
              {stat.icon}
            </div>
            <div className="text-base font-extrabold text-slate-100 font-mono tracking-tight">
              {stat.value}
            </div>
            <div className="text-[9px] text-slate-400 font-mono mt-0.5 truncate">
              {stat.trend}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
