import React, { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { GlobalSearch } from '../common/GlobalSearch';

interface HeaderProps {
  isOnline?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ isOnline = true }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { to: '/', label: 'Command Center', end: true },
    { to: '/network-map', label: 'Network Map' },
    { to: '/network-trends', label: 'Network Trends' },
    { to: '/analyze-telemetry', label: 'Analyze Telemetry' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-[0_1px_10px_rgba(0,0,0,0.02)] transition-all duration-300">
      <div className="max-w-[1440px] mx-auto px-6 h-20 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-3.5 group shrink-0">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#6366F1] to-[#7C3AED] flex items-center justify-center shadow-md shadow-indigo-500/20 group-hover:scale-105 group-hover:rotate-3 transition-all duration-300">
            <span className="material-symbols-outlined text-white text-[22px]">hub</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              <span className="font-extrabold text-xl tracking-tight text-slate-900 group-hover:text-purple-700 transition-colors duration-200">
                NEXUS<span className="text-purple-600">NET</span>
              </span>
            </div>
            <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase -mt-0.5">
              Telecom Intelligence
            </span>
          </div>
        </Link>

        {/* Floating Pill Navigation Dock (Strictly 5 Stitch Pages) */}
        <nav className="hidden lg:flex items-center bg-slate-100/80 p-1.5 rounded-full border border-slate-200/70 shadow-inner">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `px-5 py-2 rounded-full font-medium text-xs tracking-tight transition-all duration-200 ${
                  isActive
                    ? 'bg-slate-900 text-white font-semibold shadow-sm scale-[1.02]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Right Header Utilities */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Global Asset Search */}
          <GlobalSearch />

          {/* Demonstration Mode / Online Indicator */}
          <div className="hidden xl:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-50/80 border border-purple-200/60 text-purple-700 text-[11px] font-semibold transition-all">
            <span
              className={`w-2 h-2 rounded-full animate-pulse ${
                isOnline ? 'bg-emerald-500 shadow-emerald-500/50 shadow-sm' : 'bg-amber-500'
              }`}
            />
            <span>{isOnline ? 'Live Telemetry Synchronized' : 'Demo Mode (Offline Cache)'}</span>
          </div>

          {/* Primary Action Pill (Averon Style) */}
          <Link
            to="/analyze-telemetry"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-900 hover:bg-purple-950 text-white text-xs font-semibold shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 group"
          >
            <span>Quick Diagnostic</span>
            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-1 transition-transform duration-200">
              <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
            </span>
          </Link>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Toggle Navigation Menu"
          >
            <span className="material-symbols-outlined text-[24px]">
              {mobileMenuOpen ? 'close' : 'menu'}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200/70 bg-white/95 backdrop-blur-xl px-6 py-4 flex flex-col gap-2 animate-in slide-in-from-top-4 duration-200">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `px-4 py-3 rounded-xl font-medium text-xs tracking-tight transition-all flex items-center justify-between ${
                  isActive
                    ? 'bg-slate-900 text-white font-semibold'
                    : 'text-slate-700 hover:bg-purple-50'
                }`
              }
            >
              <span>{item.label}</span>
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </NavLink>
          ))}
        </div>
      )}
    </header>
  );
};
