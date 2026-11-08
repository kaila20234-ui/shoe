import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, ApiClientError } from '../api/client';
import type { AuthPayload, User } from '../types';

const TOKEN_KEY = 'shoestore_token';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (input: { name: string; email: string; password: string; phone?: string }) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => window.localStorage.getItem(TOKEN_KEY));
  const [isLoading, setIsLoading] = useState(Boolean(token));

  const refreshUser = useCallback(async () => {
    if (!window.localStorage.getItem(TOKEN_KEY)) {
      setUser(null);
      setToken(null);
      return null;
    }
    const response = await api.get<User>('/auth/me');
    setUser(response.data);
    setToken(window.localStorage.getItem(TOKEN_KEY));
    return response.data;
  }, []);

  useEffect(() => {
    let active = true;
    if (!token) {
      setIsLoading(false);
      return () => { active = false; };
    }
    api.get<User>('/auth/me')
      .then(({ data }) => { if (active) setUser(data); })
      .catch((error: unknown) => {
        if (active) setUser(null);
        if (!(error instanceof ApiClientError) || error.status !== 401) {
          console.error('Unable to restore the current session.', error);
        }
      })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [token]);

  const applyAuth = useCallback((payload: AuthPayload) => {
    window.localStorage.setItem(TOKEN_KEY, payload.token);
    setToken(payload.token);
    setUser(payload.user);
    setIsLoading(false);
    return payload.user;
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post<AuthPayload>('/auth/login', { email, password });
    return applyAuth(data);
  }, [applyAuth]);

  const register = useCallback(async (input: { name: string; email: string; password: string; phone?: string }) => {
    const { data } = await api.post<AuthPayload>('/auth/register', input);
    return applyAuth(data);
  }, [applyAuth]);

  const logout = useCallback(() => {
    window.localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, token, isLoading, login, register, logout, refreshUser }),
    [user, token, isLoading, login, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
