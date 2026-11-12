import React from 'react';

interface OfflineBannerProps {
  isOnline: boolean;
  onRetry?: () => void;
  isChecking?: boolean;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  isOnline,
  onRetry,
  isChecking = false,
}) => {
  if (isOnline) return null;

  return (
    <div className="w-full bg-amber-50 border-b border-amber-200 px-6 py-2.5 text-xs text-amber-800 flex items-center justify-between z-50">
      <div className="flex items-center gap-2 max-w-[1440px] mx-auto w-full justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-amber-600 text-[18px]">
            cloud_off
          </span>
          <span>
            <strong>Local Backend Offline:</strong> Running in interactive demonstration mode with realistic synthetic telemetry snapshots.
          </span>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            disabled={isChecking}
            className="px-3 py-1 rounded-full bg-amber-600 hover:bg-amber-700 text-white font-semibold text-[11px] transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
          >
            {isChecking ? 'Reconnecting...' : 'Retry Connection'}
          </button>
        )}
      </div>
    </div>
  );
};
