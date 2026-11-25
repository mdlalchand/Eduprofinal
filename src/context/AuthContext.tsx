import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type {
  Branch,
  CategoryItem,
  Course,
  CourseBatch,
  Ebook,
  Instructor,
  Product,
  PublicPaymentGateway,
  Review,
  SiteSettings,
  User,
  UserRole,
} from '../types';

export interface PublicBootstrapData {
  settings: SiteSettings;
  branches: Branch[];
  paymentGateways?: PublicPaymentGateway[];
  courses: Course[];
  batches?: CourseBatch[];
  instructors: Instructor[];
  products: Product[];
  ebooks: Ebook[];
  reviews: Review[];
  categories?: CategoryItem[];
  leaderboardSummary?: {
    userId: string;
    displayName: string;
    isMasked: boolean;
    xp: number;
    streakDays: number;
    badges: string[];
  }[];
  stats: {
    students: number;
    courses: number;
    teachers: number;
    videos: number;
  };
}

export interface LoginResult {
  ok: boolean;
  requires2fa?: boolean;
  setupRequired?: boolean;
}

export interface RegisterPayload {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: 'student' | 'guardian' | 'teacher' | 'branch';
  branchId?: string;
  branchName?: string;
  branchCode?: string;
  branchCity?: string;
  branchAddress?: string;
  subjectSpecialty?: string;
  education?: string;
  bio?: string;
  studentRollToLink?: string;
  studentVerification?: string;
}

export interface RegisterResult {
  ok: boolean;
  pendingApproval?: boolean;
  message?: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  bootstrap: PublicBootstrapData | null;
  loadingBootstrap: boolean;
  setupRequired: boolean;
  authError: string | null;
  login: (
    email: string,
    password: string,
    twoFactor?: { totpCode?: string; recoveryCode?: string },
    expectedRole?: UserRole
  ) => Promise<LoginResult>;
  setupAdmin: (payload: {
    name: string;
    email: string;
    phone?: string;
    password: string;
  }) => Promise<boolean>;
  register: (payload: RegisterPayload) => Promise<RegisterResult>;
  requestPasswordReset: (email: string, expectedRole?: UserRole) => Promise<string | null>;
  confirmPasswordReset: (resetToken: string, newPassword: string) => Promise<boolean>;
  logout: () => Promise<void>;
  updateUser: (nextUser: User) => void;
  refreshBootstrap: () => Promise<void>;
  refreshSetupStatus: () => Promise<void>;
  apiFetch: <T = unknown>(url: string, init?: RequestInit) => Promise<T>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Security: auth token stays in memory only (HttpOnly cookie handles session persistence)
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [bootstrap, setBootstrap] = useState<PublicBootstrapData | null>(null);
  const [loadingBootstrap, setLoadingBootstrap] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const refreshBootstrap = useCallback(async () => {
    setLoadingBootstrap(true);
    try {
      const res = await fetch('/api/public/bootstrap', { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as PublicBootstrapData;
        setBootstrap(data);
      }
    } finally {
      setLoadingBootstrap(false);
    }
  }, []);

  const refreshSetupStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/setup-status', { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as { adminConfigured?: boolean };
        setSetupRequired(data.adminConfigured === false);
      }
    } catch {
      // Ignore network hiccup
    }
  }, []);

  useEffect(() => {
    void refreshBootstrap();
    void refreshSetupStatus();
  }, [refreshBootstrap, refreshSetupStatus]);

  // Restore cookie-backed session on page load
  useEffect(() => {
    let active = true;
    fetch('/api/auth/me', {
      credentials: 'include',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    })
      .then(async (res) => {
        if (!active) return;
        if (!res.ok) {
          setUser(null);
          return;
        }
        const data = (await res.json()) as { user?: User };
        if (data.user) {
          setUser(data.user);
        }
      })
      .catch(() => {
        // Offline or unauthenticated
      });
    return () => {
      active = false;
    };
  }, []);

  const apiFetch = useCallback(
    async <T = unknown>(url: string, init: RequestInit = {}): Promise<T> => {
      const headers = new Headers(init.headers);
      headers.set('X-Requested-With', 'XMLHttpRequest');
      if (init.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
      if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      const res = await fetch(url, { ...init, headers, credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
      }
      return data as T;
    },
    [token]
  );

  const login = useCallback(
    async (
      email: string,
      password: string,
      twoFactor?: { totpCode?: string; recoveryCode?: string },
      expectedRole?: UserRole
    ): Promise<LoginResult> => {
      setAuthError(null);
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({
            email,
            password,
            expectedRole,
            totpCode: twoFactor?.totpCode,
            recoveryCode: twoFactor?.recoveryCode,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          requires2fa?: boolean;
          setupRequired?: boolean;
          token?: string;
          user?: User;
        };
        if (data.requires2fa) {
          return { ok: false, requires2fa: true };
        }
        if (!res.ok) {
          if (data.setupRequired) {
            setSetupRequired(true);
          }
          setAuthError(data.error || 'Login failed');
          return { ok: false, setupRequired: Boolean(data.setupRequired) };
        }
        setToken(data.token ?? null);
        setUser(data.user ?? null);
        return { ok: true };
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : 'Network error');
        return { ok: false };
      }
    },
    []
  );

  const setupAdmin = useCallback(
    async (payload: {
      name: string;
      email: string;
      phone?: string;
      password: string;
    }): Promise<boolean> => {
      setAuthError(null);
      try {
        const res = await fetch('/api/auth/setup-admin', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify(payload),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          token?: string;
          user?: User;
        };
        if (!res.ok) {
          setAuthError(data.error || 'Initial Main Admin setup failed');
          return false;
        }
        setToken(data.token ?? null);
        setUser(data.user ?? null);
        setSetupRequired(false);
        return true;
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : 'Network error');
        return false;
      }
    },
    []
  );

  const register = useCallback(async (payload: RegisterPayload): Promise<RegisterResult> => {
    setAuthError(null);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        pendingApproval?: boolean;
        message?: string;
        token?: string;
        user?: User;
      };
      if (!res.ok) {
        setAuthError(data.error || 'Registration failed');
        return { ok: false };
      }
      if (data.pendingApproval || !data.token) {
        return {
          ok: true,
          pendingApproval: true,
          message:
            data.message ||
            'Registration submitted! Your account is awaiting Main Admin approval before you can sign in.',
        };
      }
      setToken(data.token ?? null);
      setUser(data.user ?? null);
      return { ok: true, pendingApproval: false };
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Network error');
      return { ok: false };
    }
  }, []);

  const requestPasswordReset = useCallback(
    async (email: string, expectedRole?: UserRole): Promise<string | null> => {
      setAuthError(null);
      try {
        const res = await fetch('/api/auth/password-reset/request', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({ email, expectedRole }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
        if (!res.ok) {
          setAuthError(data.error || 'Password reset request failed');
          return null;
        }
        return data.message || 'Password reset instructions processed.';
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : 'Network error');
        return null;
      }
    },
    []
  );

  const confirmPasswordReset = useCallback(
    async (resetToken: string, newPassword: string): Promise<boolean> => {
      setAuthError(null);
      try {
        const res = await fetch('/api/auth/password-reset/confirm', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({ token: resetToken, newPassword }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setAuthError(data.error || 'Password reset confirmation failed');
          return false;
        }
        return true;
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : 'Network error');
        return false;
      }
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });
    } catch {
      // ignore network error on logout
    }
    setToken(null);
    setUser(null);
    setAuthError(null);
  }, []);

  const updateUser = useCallback((nextUser: User) => {
    setUser(nextUser);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        bootstrap,
        loadingBootstrap,
        setupRequired,
        authError,
        login,
        setupAdmin,
        register,
        requestPasswordReset,
        confirmPasswordReset,
        logout,
        updateUser,
        refreshBootstrap,
        refreshSetupStatus,
        apiFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
