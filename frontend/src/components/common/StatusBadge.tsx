import React from 'react';
import { AssetStatus } from '../../types/telecom';

interface StatusBadgeProps {
  status: AssetStatus | 'Low' | 'Medium' | 'High' | 'Normal' | 'Outlier' | 'OPEN' | 'ACKNOWLEDGED' | 'INVESTIGATING' | 'RESOLVED' | 'ESCALATED';
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<{
  status: AssetStatus | 'Low' | 'Medium' | 'High' | 'Normal' | 'Outlier' | 'OPEN' | 'ACKNOWLEDGED' | 'INVESTIGATING' | 'RESOLVED' | 'ESCALATED' | 'Critical' | 'Warning' | 'Anomaly' | 'At Risk';
  size?: 'sm' | 'md' | 'lg';
}> = ({ status, size = 'md' }) => {
  let styleClasses = 'bg-slate-800 text-slate-300 border-slate-700';
  let label = status;

  switch (status.toLowerCase()) {
    case 'healthy':
    case 'normal':
    case 'low':
    case 'resolved':
      styleClasses = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40 shadow-sm';
      break;
    case 'warning':
    case 'medium':
    case 'acknowledged':
      styleClasses = 'bg-amber-500/15 text-amber-400 border-amber-500/40 shadow-sm';
      break;
    case 'critical':
    case 'high':
    case 'at risk':
    case 'open':
    case 'escalated':
      styleClasses = 'bg-red-500/15 text-red-400 border-red-500/40 shadow-noc-red animate-pulse';
      break;
    case 'anomaly':
    case 'outlier':
    case 'investigating':
      styleClasses = 'bg-purple-500/15 text-purple-400 border-purple-500/40 shadow-noc-purple';
      break;
  }

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : size === 'lg' ? 'px-3.5 py-1 text-xs' : 'px-2.5 py-0.5 text-xs';

  return (
    <span className={`inline-flex items-center gap-1.5 font-mono font-semibold rounded-full border uppercase tracking-wider ${styleClasses} ${sizeClasses}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
      <span>{label}</span>
    </span>
  );
};
