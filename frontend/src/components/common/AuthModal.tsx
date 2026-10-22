import React, { useState } from 'react';
import { Shield, Key, UserCheck, LogOut, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth, UserRole } from '../../context/AuthContext';

export const AuthModal: React.FC = () => {
  const { user, role, showLoginModal, setShowLoginModal, login, logout, switchDemoRole, isLoading } = useAuth();

  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  if (!showLoginModal) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login(username, password);
      setUsername('');
      setPassword('');
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Verify credentials.');
    }
  };

  const handleRoleSwitch = async (target: UserRole) => {
    setError(null);
    try {
      await switchDemoRole(target);
    } catch (err: any) {
      setError(err.message || 'Failed to switch role.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in font-sans">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <Shield size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                NOC Role-Based Access Control
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Backend-enforced authentication & permission tiers
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowLoginModal(false)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Current User Pill */}
        {user && (
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCheck size={16} className="text-emerald-500" />
              <div>
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 block">
                  {user.full_name} ({user.username})
                </span>
                <span className="text-[11px] text-slate-500 font-mono capitalize">
                  Active Role: <strong className="text-blue-500">{role.replace('_', ' ')}</strong>
                </span>
              </div>
            </div>
            <button
              onClick={logout}
              disabled={isLoading}
              className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <LogOut size={13} />
              <span>Sign Out</span>
            </button>
          </div>
        )}

        {/* Quick Demo Role Switcher */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
            Quick Presentation Role Switcher
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleRoleSwitch('noc_analyst')}
              disabled={isLoading}
              className={`p-2.5 rounded-xl border text-center transition-all ${
                role === 'noc_analyst'
                  ? 'bg-blue-500/10 border-blue-500 text-blue-500 font-bold shadow-sm'
                  : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-400'
              }`}
            >
              <span className="text-xs block font-semibold">NOC Analyst</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Read/Ingest</span>
            </button>

            <button
              onClick={() => handleRoleSwitch('network_engineer')}
              disabled={isLoading}
              className={`p-2.5 rounded-xl border text-center transition-all ${
                role === 'network_engineer'
                  ? 'bg-purple-500/10 border-purple-500 text-purple-500 font-bold shadow-sm'
                  : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-400'
              }`}
            >
              <span className="text-xs block font-semibold">Engineer</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Diagnostics</span>
            </button>

            <button
              onClick={() => handleRoleSwitch('admin')}
              disabled={isLoading}
              className={`p-2.5 rounded-xl border text-center transition-all ${
                role === 'admin'
                  ? 'bg-amber-500/10 border-amber-500 text-amber-500 font-bold shadow-sm'
                  : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-400'
              }`}
            >
              <span className="text-xs block font-semibold">Administrator</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Full System</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs flex items-center gap-2">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        {/* Custom Login Form */}
        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Or Sign In with Credentials
            </label>
          </div>
          <div>
            <input
              type="text"
              required
              placeholder="Username (e.g. admin, engineer, analyst)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <input
              type="password"
              required
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
          >
            <Key size={14} />
            <span>{isLoading ? 'Verifying Credentials...' : 'Authenticate & Issue Token'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
