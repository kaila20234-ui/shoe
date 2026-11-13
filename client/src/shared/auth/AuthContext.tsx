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
import { authTokenKeys, roleBelongsToSession, type AuthSession } from './session';

const LEGACY_TOKEN_KEY = 'shoestore_token';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (input: { name: string; email: string; password: string; phone?: string }) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<User | null>;
}

const CustomerAuthContext = createContext<AuthContextValue | null>(null);
const StaffAuthContext = createContext<AuthContextValue | null>(null);

function useSessionAuth(session: AuthSession): AuthContextValue {
  const tokenKey = authTokenKeys[session];
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => window.localStorage.getItem(tokenKey));
  const [isLoading, setIsLoading] = useState(Boolean(token));

  const refreshUser = useCallback(async () => {
    if (!window.localStorage.getItem(tokenKey)) {
      setUser(null);
      setToken(null);
      return null;
    }
    const response = await api.get<User>('/auth/me', { authSession: session });
    if (!roleBelongsToSession(response.data.role, session)) {
      window.localStorage.removeItem(tokenKey);
      setUser(null);
      setToken(null);
      return null;
    }
    setUser(response.data);
    setToken(window.localStorage.getItem(tokenKey));
    return response.data;
  }, [session, tokenKey]);

  useEffect(() => {
    let active = true;
    if (!token) {
      setIsLoading(false);
      return () => { active = false; };
    }
    api.get<User>('/auth/me', { authSession: session })
      .then(({ data }) => {
        if (!active) return;
        if (!roleBelongsToSession(data.role, session)) {
          window.localStorage.removeItem(tokenKey);
          setUser(null);
          setToken(null);
          return;
        }
        setUser(data);
      })
      .catch((error: unknown) => {
        if (active) setUser(null);
        if (!(error instanceof ApiClientError) || error.status !== 401) {
          console.error('Unable to restore the current session.', error);
        }
      })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [session, token, tokenKey]);

  useEffect(() => {
    function syncSession(event: StorageEvent) {
      if (event.key !== tokenKey && event.key !== null) return;
      const nextToken = window.localStorage.getItem(tokenKey);
      setUser(null);
      setToken(nextToken);
      setIsLoading(Boolean(nextToken));
    }

    window.addEventListener('storage', syncSession);
    return () => window.removeEventListener('storage', syncSession);
  }, [tokenKey]);

  const applyAuth = useCallback((payload: AuthPayload) => {
    window.localStorage.setItem(tokenKey, payload.token);
    setToken(payload.token);
    setUser(payload.user);
    setIsLoading(false);
    return payload.user;
  }, [tokenKey]);

  const login = useCallback(async (email: string, password: string) => {
    const loginPath = session === 'staff' ? '/auth/admin/login' : '/auth/login';
    const { data } = await api.post<AuthPayload>(loginPath, { email, password });
    if (!roleBelongsToSession(data.user.role, session)) {
      throw new ApiClientError(
        'FORBIDDEN',
        session === 'customer'
          ? 'This account does not have customer access.'
          : 'This account does not have staff access.',
        403,
      );
    }
    return applyAuth(data);
  }, [applyAuth, session]);

  const register = useCallback(async (input: { name: string; email: string; password: string; phone?: string }) => {
    const { data } = await api.post<AuthPayload>('/auth/register', input);
    if (!roleBelongsToSession(data.user.role, session)) {
      throw new ApiClientError('FORBIDDEN', 'This account does not have customer access.', 403);
    }
    return applyAuth(data);
  }, [applyAuth, session]);

  const logout = useCallback(() => {
    window.localStorage.removeItem(tokenKey);
    setToken(null);
    setUser(null);
  }, [tokenKey]);

  const value = useMemo(
    () => ({ user, token, isLoading, login, register, logout, refreshUser }),
    [user, token, isLoading, login, register, logout, refreshUser],
  );

  return value;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const customerAuth = useSessionAuth('customer');
  const staffAuth = useSessionAuth('staff');

  useEffect(() => {
    window.localStorage.removeItem(LEGACY_TOKEN_KEY);
  }, []);

  return (
    <CustomerAuthContext.Provider value={customerAuth}>
      <StaffAuthContext.Provider value={staffAuth}>{children}</StaffAuthContext.Provider>
    </CustomerAuthContext.Provider>
  );
}

export function useAuth(session: AuthSession): AuthContextValue {
  const customerContext = useContext(CustomerAuthContext);
  const staffContext = useContext(StaffAuthContext);
  const context = session === 'customer' ? customerContext : staffContext;
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
