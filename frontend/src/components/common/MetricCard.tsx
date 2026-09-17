import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  trend?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
  status?: 'healthy' | 'warning' | 'critical' | 'anomaly';
  sparklineData?: number[];
  subtext?: string;
  icon?: React.ReactNode;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  trend,
  trendDirection = 'neutral',
  status = 'healthy',
  sparklineData = [30, 45, 32, 60, 55, 75, 65, 80],
  subtext,
  icon
}) => {
  let borderClass = 'border-[#1e2d4a] hover:border-cyan-500/50';
  let valueColor = 'text-slate-100';

  if (status === 'critical') {
    borderClass = 'border-red-500/50 bg-red-950/10 shadow-noc-red';
    valueColor = 'text-red-400';
  } else if (status === 'warning') {
    borderClass = 'border-amber-500/50 bg-amber-950/10';
    valueColor = 'text-amber-400';
  } else if (status === 'anomaly') {
    borderClass = 'border-purple-500/50 bg-purple-950/10 shadow-noc-purple';
    valueColor = 'text-purple-400';
  }

  // Generate SVG path for sparkline
  const min = Math.min(...sparklineData);
  const max = Math.max(...sparklineData);
  const range = max - min || 1;
  const width = 120;
  const height = 30;

  const points = sparklineData
    .map((val, idx) => {
      const x = (idx / (sparklineData.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 6) - 3;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className={`p-4 rounded-xl bg-[#0c1322] border transition-all ${borderClass}`}>
      <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-2">
        <span className="font-semibold uppercase tracking-wider">{title}</span>
        {icon && <span className="text-cyan-400">{icon}</span>}
      </div>

      <div className="flex items-baseline gap-1.5 my-1">
        <span className={`text-2xl lg:text-3xl font-extrabold font-mono ${valueColor}`}>
          {value}
        </span>
        {unit && <span className="text-xs font-mono text-slate-400">{unit}</span>}
      </div>

      <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#1e2d4a]/60">
        <div className="flex items-center gap-1 text-[11px] font-mono">
          {trendDirection === 'up' && <TrendingUp size={14} className="text-emerald-400" />}
          {trendDirection === 'down' && <TrendingDown size={14} className="text-red-400" />}
          {trendDirection === 'neutral' && <Minus size={14} className="text-slate-400" />}
          <span className={trendDirection === 'up' ? 'text-emerald-400' : trendDirection === 'down' ? 'text-red-400' : 'text-slate-400'}>
            {trend}
          </span>
        </div>

        {/* Mini Sparkline Chart */}
        <svg width={width} height={height} className="overflow-visible">
          <polyline
            fill="none"
            stroke={status === 'critical' ? '#ef4444' : status === 'warning' ? '#f59e0b' : status === 'anomaly' ? '#a855f7' : '#00f0ff'}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points}
          />
        </svg>
      </div>

      {subtext && <div className="text-[10px] text-slate-400 font-mono mt-1">{subtext}</div>}
    </div>
  );
};
