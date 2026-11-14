import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../ui';
import { useAdminDataStore } from '../../admin/components/AdminDataStore';
import '../../admin/admin.css';

type NavigationItem = readonly [to: string, label: string, icon: string];

const navGroups: readonly { title: string; links: readonly NavigationItem[] }[] = [
  { title: 'Workspace', links: [['/admin', 'Overview', 'overview']] },
  { title: 'Store management', links: [
    ['/admin/products', 'Products', 'products'],
    ['/admin/orders', 'Orders', 'orders'],
    ['/admin/customers', 'Customers', 'customers'],
    ['/admin/inventory', 'Inventory', 'inventory'],
  ] },
  { title: 'Operations', links: [
    ['/admin/discounts', 'Discounts', 'discounts'],
    ['/admin/delivery', 'Delivery zones', 'delivery'],
    ['/admin/reviews', 'Reviews', 'reviews'],
    ['/admin/returns', 'Returns', 'returns'],
  ] },
  { title: 'Administration', links: [
    ['/admin/team', 'Team accounts', 'team'],
    ['/admin/audit-logs', 'Audit logs', 'audit'],
  ] },
];

const iconPaths: Record<string, string> = {
  overview: 'M3.5 3.5h7v7h-7zM13.5 3.5h7v4h-7zM13.5 10.5h7v10h-7zM3.5 13.5h7v7h-7z',
  products: 'M4 8.5 12 4l8 4.5-8 4.5-8-4.5ZM4 8.5v7l8 4.5 8-4.5v-7M12 13v7',
  orders: 'M6 4h12a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 18 20H6a1.5 1.5 0 0 1-1.5-1.5v-13A1.5 1.5 0 0 1 6 4ZM8 8h8m-8 4h8m-8 4h5',
  customers: 'M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20m5.5-9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7-7.5a4 4 0 0 1 0 7.5m2.5 3h.5a4 4 0 0 1 4 4V20',
  inventory: 'm4 8 8-4.5L20 8v8l-8 4.5L4 16V8Zm.5.25L12 12.5l7.5-4.25M12 12.5v8',
  discounts: 'M20 13 13 20l-9-9V4h7l9 9Zm-11.5-4.5h.01',
  delivery: 'M3 6h11v11H3zM14 10h4l3 3v4h-7zM7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm11 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  reviews: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z',
  returns: 'M4 7h12a4 4 0 0 1 0 8H8m0 0 3-3m-3 3 3 3M5 4v3H2',
  team: 'M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20m5.5-9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8-5v6m-3-3h6',
  audit: 'M5 4h14v16H5zM8 8h8m-8 4h8m-8 4h5',
};

function NavigationIcon({ name }: { name: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={iconPaths[name]} /></svg>;
}

export function AdminLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, logout } = useAuth('staff');
  const { isLoading, loadError, refreshAdminData } = useAdminDataStore();
  const location = useLocation();
  const navigate = useNavigate();
  const pageTitle = navGroups.flatMap((group) => group.links)
    .find(([to]) => to === location.pathname)?.[1] ?? 'Store management';
  return (
    <div className="shared-admin-shell">
      <aside className={`shared-admin-side${menuOpen ? ' is-open' : ''}`}>
        <Link className="shared-admin-brand" to="/admin">
          <span className="shared-admin-brand__mark" aria-hidden="true">S</span>
          <span>SHOE STORE<small>ADMIN CONSOLE</small></span>
        </Link>
        <div className="shared-admin-profile">
          <span className="shared-admin-profile__avatar">{user?.name.trim().charAt(0).toUpperCase() ?? 'A'}</span>
          <span><strong>{user?.name ?? 'Administrator'}</strong><small>Store administrator</small></span>
          <span className="shared-admin-profile__status" aria-label="Online" />
        </div>
        <nav aria-label="Admin navigation">
          {navGroups.map((group) => (
            <div className="shared-admin-nav-group" key={group.title}>
              <span className="shared-admin-nav-title">{group.title}</span>
              {group.links.map(([to, label, icon]) => (
                <NavLink key={to} to={to} end={to === '/admin'} onClick={() => setMenuOpen(false)}>
                  <NavigationIcon name={icon} /><span>{label}</span>
                  {to === '/admin' && <span className="shared-admin-nav-current" />}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="shared-admin-side-bottom">
          <span className="shared-admin-side-bottom__label">Shoe Store · Admin</span>
          <Link to="/">Visit storefront <span aria-hidden="true">↗</span></Link>
        </div>
      </aside>
      <div className="shared-admin-main">
        <header className="shared-admin-top">
          <div className="shared-admin-top__left">
            <Button className="shared-admin-toggle" variant="secondary" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen}>
              {menuOpen ? 'Close menu' : '☰'}
            </Button>
            <span className="shared-admin-breadcrumb">Workspace <span>/</span> <strong>{pageTitle}</strong></span>
          </div>
          <div className="shared-admin-top__right">
            {isLoading && <span className="shared-admin-sync" role="status"><i /> Syncing</span>}
            <span className="shared-admin-top__divider" />
            <div className="shared-admin-top__user">
              <span className="shared-admin-top__avatar">{user?.name.trim().charAt(0).toUpperCase() ?? 'A'}</span>
              <span><strong>{user?.name ?? 'Administrator'}</strong><small>Administrator</small></span>
            </div>
            <Button variant="ghost" className="shared-admin-signout" onClick={() => { logout(); navigate('/admin/login'); }}>Sign out</Button>
          </div>
        </header>
        {loadError && <p role="alert" className="shared-admin-error">{loadError} <Button variant="secondary" onClick={() => void refreshAdminData()}>Retry</Button></p>}
        <div className="shared-admin-route-content"><Outlet /></div>
      </div>
    </div>
  );
}
