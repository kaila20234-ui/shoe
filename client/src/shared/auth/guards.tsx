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
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <Spinner label="Checking your session" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (!roles.includes(user.role)) return <Navigate to={homeForRole(user.role)} replace />;
  return children ? <>{children}</> : <Outlet />;
}

export function GuestOnly({ children }: { children?: ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <Spinner label="Checking your session" />;
  if (user) return <Navigate to={homeForRole(user.role)} replace />;
  return children ? <>{children}</> : <Outlet />;
}
