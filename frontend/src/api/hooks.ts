import { useCallback, useEffect, useState } from 'react';
import { HealthResponse, SystemConfig } from '../types/api';
import { getConfig, getHealth } from './client';

export const STATUS_COLORS: Record<
  string,
  {
    bg: string;
    text: string;
    border: string;
    badge: string;
    hex: string;
    label: string;
  }
> = {
  red: {
    bg: 'bg-red-500/10 dark:bg-red-500/20',
    text: 'text-red-700 dark:text-red-400',
    border: 'border-red-500/30',
    badge: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-300 dark:border-red-800',
    hex: '#ef4444',
    label: 'At Risk',
  },
  purple: {
    bg: 'bg-purple-500/10 dark:bg-purple-500/20',
    text: 'text-purple-700 dark:text-purple-400',
    border: 'border-purple-500/30',
    badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-300 dark:border-purple-800',
    hex: '#a855f7',
    label: 'Multivariate Anomaly',
  },
  yellow: {
    bg: 'bg-amber-500/10 dark:bg-amber-500/20',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-500/30',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300 dark:border-amber-800',
    hex: '#eab308',
    label: 'Near-Threshold Warning',
  },
  green: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-500/30',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
    hex: '#22c55e',
    label: 'Healthy / Optimal',
  },
};

export function getStatusStyle(status: string) {
  return STATUS_COLORS[status?.toLowerCase()] || STATUS_COLORS.green;
}

export function useApiStatus(pollIntervalMs: number = 15000) {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = useCallback(async () => {
    setIsChecking(true);
    try {
      const data = await getHealth();
      setHealth(data);
      setIsOnline(true);
      setError(null);
    } catch (err: any) {
      setIsOnline(false);
      setHealth(null);
      setError(err?.message || 'Backend server is offline');
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, pollIntervalMs);
    return () => clearInterval(interval);
  }, [checkHealth, pollIntervalMs]);

  return { isOnline, isChecking, health, error, checkHealth };
}

let cachedConfig: SystemConfig | null = null;
let cachedConfigPromise: Promise<SystemConfig> | null = null;

export function useConfig() {
  const [config, setConfig] = useState<SystemConfig | null>(cachedConfig);
  const [isLoading, setIsLoading] = useState<boolean>(!cachedConfig);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cachedConfig) {
      setConfig(cachedConfig);
      setIsLoading(false);
      return;
    }

    if (!cachedConfigPromise) {
      cachedConfigPromise = getConfig();
    }

    cachedConfigPromise
      .then((cfg) => {
        cachedConfig = cfg;
        setConfig(cfg);
        setError(null);
      })
      .catch((err) => {
        setError(err?.message || 'Failed to fetch configuration');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  return { config, isLoading, error };
}
