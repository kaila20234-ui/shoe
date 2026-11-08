import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../ui';
import { useAdminMockStore } from '../../admin/components/AdminMockStore';

const links = [
  ['/admin', 'Dashboard'],
  ['/admin/products', 'Products'],
  ['/admin/orders', 'Orders'],
  ['/admin/customers', 'Customers'],
  ['/admin/inventory', 'Inventory'],
  ['/admin/discounts', 'Discounts'],
  ['/admin/delivery', 'Delivery zones'],
  ['/admin/reviews', 'Reviews'],
  ['/admin/returns', 'Returns'],
  ['/admin/audit-logs', 'Audit logs'],
] as const;

export function AdminLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const { isLoading, loadError, refreshAdminData } = useAdminMockStore();
  return (
    <div className="shared-admin-shell">
      <aside className={`shared-admin-side${menuOpen ? ' is-open' : ''}`}>
        <Link className="shared-admin-brand" to="/admin">SHOE STORE <small>Admin</small></Link>
        <nav aria-label="Admin navigation">
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/admin'} onClick={() => setMenuOpen(false)}>{label}</NavLink>
          ))}
        </nav>
      </aside>
      <div className="shared-admin-main">
        {isLoading && <p role="status" className="shared-muted">Loading admin data…</p>}
        {loadError && <p role="alert" className="storefront-error">{loadError} <Button variant="secondary" onClick={() => void refreshAdminData()}>Retry</Button></p>}
        <header className="shared-admin-top">
          <Button className="shared-admin-toggle" variant="secondary" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen}>
            {menuOpen ? 'Close menu' : 'Menu'}
          </Button>
          <span>Signed in as {user?.name ?? 'Administrator'}</span>
          <Button variant="ghost" onClick={logout}>Sign out</Button>
        </header>
        <Outlet />
      </div>
    </div>
  );
}
