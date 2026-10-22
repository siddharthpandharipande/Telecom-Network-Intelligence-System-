import React, { useId } from 'react';
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

function createSmoothPath(data: number[], width: number, height: number): { path: string; area: string; lastPoint: [number, number] } {
  if (!data || data.length === 0) return { path: '', area: '', lastPoint: [0, 0] };
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const paddingY = 4;
  const h = height - paddingY * 2;

  const pts: [number, number][] = data.map((val, idx) => {
    const x = (idx / Math.max(1, data.length - 1)) * width;
    const y = height - paddingY - ((val - min) / range) * h;
    return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
  });

  if (pts.length === 1) return { path: `M ${pts[0][0]},${pts[0][1]}`, area: '', lastPoint: pts[0] };

  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const cpx1 = p0[0] + (p1[0] - p0[0]) / 2;
    const cpy1 = p0[1];
    const cpx2 = p0[0] + (p1[0] - p0[0]) / 2;
    const cpy2 = p1[1];
    d += ` C ${cpx1},${cpy1} ${cpx2},${cpy2} ${p1[0]},${p1[1]}`;
  }

  const lastPt = pts[pts.length - 1];
  const area = `${d} L ${lastPt[0]},${height} L ${pts[0][0]},${height} Z`;

  return { path: d, area, lastPoint: lastPt };
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  trend,
  trendDirection = 'neutral',
  status = 'healthy',
  sparklineData = [35, 42, 38, 55, 50, 68, 62, 75],
  subtext,
  icon
}) => {
  const gradientId = useId().replace(/:/g, '_');
  let borderClass = 'border-[#1e2d4a] hover:border-cyan-500/50';
  let valueColor = 'text-slate-100';
  let strokeColor = '#00f0ff';

  if (status === 'critical') {
    borderClass = 'border-red-500/50 bg-red-950/10 shadow-noc-red';
    valueColor = 'text-red-400';
    strokeColor = '#ef4444';
  } else if (status === 'warning') {
    borderClass = 'border-amber-500/50 bg-amber-950/10';
    valueColor = 'text-amber-400';
    strokeColor = '#f59e0b';
  } else if (status === 'anomaly') {
    borderClass = 'border-purple-500/50 bg-purple-950/10 shadow-noc-purple';
    valueColor = 'text-purple-400';
    strokeColor = '#a855f7';
  }

  const { path, area, lastPoint } = createSmoothPath(sparklineData, 64, 28);

  return (
    <div className={`p-4 rounded-xl bg-[#0c1322] border transition-all overflow-hidden flex flex-col justify-between ${borderClass}`}>
      <div>
        <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-2">
          <span className="font-semibold uppercase tracking-wider truncate">{title}</span>
          {icon && <span className="text-cyan-400 shrink-0 ml-1">{icon}</span>}
        </div>

        <div className="flex items-baseline gap-1.5 my-1">
          <span className={`text-2xl font-extrabold font-mono truncate ${valueColor}`}>
            {value}
          </span>
          {unit && <span className="text-xs font-mono text-slate-400 shrink-0">{unit}</span>}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#1e2d4a]/60 gap-2">
          <div className="flex items-center gap-1 text-[11px] font-mono min-w-0 truncate">
            {trendDirection === 'up' && <TrendingUp size={13} className="text-emerald-400 shrink-0" />}
            {trendDirection === 'down' && <TrendingDown size={13} className="text-red-400 shrink-0" />}
            {trendDirection === 'neutral' && <Minus size={13} className="text-slate-400 shrink-0" />}
            <span className={`truncate ${trendDirection === 'up' ? 'text-emerald-400' : trendDirection === 'down' ? 'text-red-400' : 'text-slate-400'}`}>
              {trend}
            </span>
          </div>

          {/* Elegant smooth sparkline strictly contained in micro-box */}
          <div className="w-16 h-7 shrink-0 relative overflow-hidden rounded bg-slate-900/60 border border-slate-800/80 p-0.5">
            <svg viewBox="0 0 64 28" preserveAspectRatio="none" className="w-full h-full block">
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={strokeColor} stopOpacity="0.4" />
                  <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
                </linearGradient>
              </defs>
              {area && <path d={area} fill={`url(#${gradientId})`} />}
              {path && (
                <path
                  d={path}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {lastPoint && (
                <circle cx={lastPoint[0]} cy={lastPoint[1]} r="2.5" fill={strokeColor} />
              )}
            </svg>
          </div>
        </div>

        {subtext && <div className="text-[10px] text-slate-400 font-mono mt-1.5 truncate">{subtext}</div>}
      </div>
    </div>
  );
};

