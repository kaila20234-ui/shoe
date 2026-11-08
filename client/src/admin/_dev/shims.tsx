import type { ReactNode } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { AdminMockStoreProvider } from '../components/AdminMockStore';
import '../admin.css';

export function RequireAuth({ children }: { children: ReactNode; roles?: string[] }) {
  return <>{children}</>;
}

export function AdminLayout() {
  const links = [
    ['Dashboard', '/admin'],
    ['Products', '/admin/products'],
    ['Orders', '/admin/orders'],
    ['Customers', '/admin/customers'],
    ['Inventory', '/admin/inventory'],
    ['Discounts', '/admin/discounts'],
    ['Delivery', '/admin/delivery'],
    ['Reviews', '/admin/reviews'],
    ['Returns', '/admin/returns'],
    ['Audit Logs', '/admin/audit-logs']
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">Shoe Store</div>
        <nav>
          {links.map(([label, to]) => (
            <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <AdminMockStoreProvider>
        <main className="content">
          <header className="topbar">
            <div>Admin Console</div>
            <div className="admin-actions">
              <span className="badge warning">Demo data · not persisted</span>
              <Link to="/admin" className="button small">Overview</Link>
            </div>
          </header>
          <Outlet />
        </main>
      </AdminMockStoreProvider>
    </div>
  );
}
