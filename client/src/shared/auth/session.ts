import type { Role } from '../types';

export type AuthSession = 'customer' | 'staff';

export const authTokenKeys: Record<AuthSession, string> = {
  customer: 'shoestore_customer_token',
  staff: 'shoestore_staff_token',
};

export function roleBelongsToSession(role: Role, session: AuthSession): boolean {
  return session === 'customer' ? role === 'customer' : role === 'admin' || role === 'owner';
}

export function sessionForRequest(url: string | undefined, pagePath: string): AuthSession | null {
  if (!url) return null;

  const path = new URL(url, window.location.origin).pathname.replace(/^\/api(?=\/)/, '');
  if (/^\/auth\/(login|admin\/login|register|forgot-password|reset-password)$/.test(path)) return null;
  if (/^\/(admin|owner|audit-logs)(\/|$)/.test(path)) return 'staff';
  if (path.startsWith('/auth/')) {
    return pagePath.startsWith('/admin') || pagePath.startsWith('/owner') ? 'staff' : 'customer';
  }
  return 'customer';
}
