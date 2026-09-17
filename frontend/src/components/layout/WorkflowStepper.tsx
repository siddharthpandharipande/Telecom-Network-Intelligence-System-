import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Database, Cpu, Activity, MapPin, CheckCircle2, ArrowRight } from 'lucide-react';
import { useTelemetry } from '../../context/TelemetryContext';

export const WorkflowStepper: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeWorkflowStep, setActiveWorkflowStep, submittedState } = useTelemetry();

  const steps = [
    { id: 1, label: 'Data Input', path: '/data-input', icon: <Database size={16} /> },
    { id: 2, label: 'AI Analysis (SVM & DBSCAN)', path: '/svm', altPath: '/dbscan', icon: <Cpu size={16} /> },
    { id: 3, label: 'Network Health', path: '/health', icon: <Activity size={16} /> },
    { id: 4, label: 'Live Network Map', path: '/map', icon: <MapPin size={16} /> },
  ];

  const getStepStatus = (stepId: number, stepPath: string, altPath?: string) => {
    const isCurrentPage = location.pathname === stepPath || (altPath && location.pathname === altPath);
    if (isCurrentPage) return 'current';
    if (submittedState === 'analyzed' && stepId <= activeWorkflowStep) return 'completed';
    if (submittedState === 'submitted' && stepId === 1) return 'completed';
    return 'pending';
  };

  return (
    <div className="w-full bg-[#080d19] border-b border-[#1e2d4a] px-6 py-2.5 font-mono text-xs">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-slate-400 font-extrabold uppercase text-[11px]">
          <span className="text-cyan-400 animate-pulse">●</span>
          <span>NOC PIPELINE PROGRESS:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 flex-1 justify-start md:justify-center">
          {steps.map((step, idx) => {
            const status = getStepStatus(step.id, step.path, step.altPath);

            return (
              <React.Fragment key={step.id}>
                <button
                  onClick={() => {
                    setActiveWorkflowStep(step.id);
                    navigate(step.path);
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-bold transition-all shadow-sm ${
                    status === 'current'
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-noc-cyan scale-105'
                      : status === 'completed'
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25'
                      : 'bg-[#0c1322] text-slate-400 border-[#1e2d4a] hover:text-slate-200'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full text-[11px] flex items-center justify-center font-extrabold ${
                    status === 'current'
                      ? 'bg-cyan-400 text-black'
                      : status === 'completed'
                      ? 'bg-emerald-500 text-black'
                      : 'bg-[#1e2d4a] text-slate-400'
                  }`}>
                    {status === 'completed' ? <CheckCircle2 size={13} className="text-black" /> : step.id}
                  </span>
                  <span>{step.label}</span>
                </button>

                {idx < steps.length - 1 && (
                  <ArrowRight size={14} className="text-slate-600 hidden sm:block" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};
