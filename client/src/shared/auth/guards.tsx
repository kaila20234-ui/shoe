import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import type { Role } from '../types';
import { Spinner } from '../ui';

function homeForRole(role: Role | undefined): string {
  if (role === 'admin') return '/admin';
  if (role === 'owner') return '/owner';
  return '/';
}

export function RequireAuth({ roles, children }: { roles: Role[]; children?: ReactNode }) {
  const session = roles.includes('customer') ? 'customer' : 'staff';
  const { user, isLoading } = useAuth(session);
  const location = useLocation();

  if (isLoading) return <Spinner label="Checking your session" />;
  if (!user) {
    const loginPath = location.pathname.startsWith('/admin') ? '/admin/login' : '/login';
    return <Navigate to={loginPath} replace state={{ from: location }} />;
  }
  if (!roles.includes(user.role)) return <Navigate to={homeForRole(user.role)} replace />;
  return children ? <>{children}</> : <Outlet />;
}

export function GuestOnly({ children }: { children?: ReactNode }) {
  const { user, isLoading } = useAuth('customer');
  if (isLoading) return <Spinner label="Checking your session" />;
  if (user) return <Navigate to={homeForRole(user.role)} replace />;
  return children ? <>{children}</> : <Outlet />;
}
