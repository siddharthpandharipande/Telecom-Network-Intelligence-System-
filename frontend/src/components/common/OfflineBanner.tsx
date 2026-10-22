import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface OfflineBannerProps {
  isOnline: boolean;
  onRetry?: () => void;
  isChecking?: boolean;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({ isOnline, onRetry, isChecking }) => {
  if (isOnline) return null;

  return (
    <div
      role="alert"
      className="sticky top-0 z-50 w-full bg-red-600 text-white px-4 py-2.5 shadow-md flex items-center justify-between text-xs sm:text-sm font-semibold transition-all animate-pulse"
    >
      <div className="flex items-center gap-2 max-w-4xl mx-auto">
        <AlertTriangle size={18} className="flex-shrink-0 text-white" />
        <span>
          Backend offline: showing no data, actions disabled (unable to reach FastAPI server at http://127.0.0.1:8000)
        </span>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          disabled={isChecking}
          className="ml-3 inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 hover:bg-white/30 active:bg-white/40 text-white rounded text-xs font-bold transition-all disabled:opacity-50"
        >
          <RefreshCw size={12} className={isChecking ? 'animate-spin' : ''} />
          {isChecking ? 'Checking...' : 'Retry'}
        </button>
      )}
    </div>
  );
};
