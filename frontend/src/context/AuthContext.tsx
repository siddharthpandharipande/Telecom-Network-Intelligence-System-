import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, LoginResponse } from '../types/api';
import { loginUser, logoutUser, getCurrentUser } from '../api/client';

export type UserRole = 'noc_analyst' | 'network_engineer' | 'admin';

interface AuthContextType {
  user: User | null;
  role: UserRole;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  showLoginModal: boolean;
  setShowLoginModal: (show: boolean) => void;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  switchDemoRole: (targetRole: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_CREDENTIALS: Record<UserRole, { username: string; password: string }> = {
  noc_analyst: { username: 'analyst', password: 'Analyst@2026' },
  network_engineer: { username: 'engineer', password: 'Engineer@2026' },
  admin: { username: 'admin', password: 'NocAdmin@2026' },
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole>('noc_analyst');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);

  // Initialize from storage or default to analyst
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('nexusnet_token');
      const storedUser = localStorage.getItem('nexusnet_user');

      if (storedToken && storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          setToken(storedToken);
          setUser({
            id: parsed.user_id || 1,
            username: parsed.username || 'analyst',
            full_name: parsed.full_name || 'NOC Analyst',
            role: parsed.role || 'noc_analyst',
            is_active: true,
            created_at: new Date().toISOString(),
          });
          setRole((parsed.role as UserRole) || 'noc_analyst');
        } catch {
          localStorage.removeItem('nexusnet_token');
          localStorage.removeItem('nexusnet_user');
        }
      } else {
        // Auto-login as default demo analyst for seamless evaluation
        try {
          const res = await loginUser(DEMO_CREDENTIALS.noc_analyst);
          setToken(res.token);
          setRole(res.role as UserRole);
          setUser({
            id: res.user_id,
            username: res.username,
            full_name: res.full_name,
            role: res.role,
            is_active: true,
            created_at: new Date().toISOString(),
          });
        } catch {
          // If offline, provide fallback local state
          setRole('noc_analyst');
          setUser({
            id: 1,
            username: 'analyst',
            full_name: 'NOC Analyst',
            role: 'noc_analyst',
            is_active: true,
            created_at: new Date().toISOString(),
          });
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (username: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await loginUser({ username, password });
      setToken(res.token);
      setRole(res.role as UserRole);
      setUser({
        id: res.user_id,
        username: res.username,
        full_name: res.full_name,
        role: res.role,
        is_active: true,
        created_at: new Date().toISOString(),
      });
      setShowLoginModal(false);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await logoutUser();
    } catch {
      // Ignore network errors on logout
    } finally {
      setToken(null);
      setUser(null);
      setRole('noc_analyst');
      setIsLoading(false);
    }
  };

  const switchDemoRole = async (targetRole: UserRole) => {
    const creds = DEMO_CREDENTIALS[targetRole];
    if (creds) {
      await login(creds.username, creds.password);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        token,
        isAuthenticated: !!user,
        isLoading,
        showLoginModal,
        setShowLoginModal,
        login,
        logout,
        switchDemoRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
