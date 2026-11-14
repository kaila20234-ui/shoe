import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../ui';

export function OwnerLayout() {
  const { logout, user } = useAuth('staff');
  return (
    <div className="shared-layout">
      <header className="shared-nav shared-owner-top">
        <div className="shared-nav-inner">
          <NavLink className="shared-brand" to="/owner">SHOE STORE <span className="shared-muted">· Owner</span></NavLink>
          <nav className="shared-nav-links" aria-label="Owner navigation">
            <NavLink to="/owner" end>Overview</NavLink>
            <NavLink to="/owner/transactions">Transactions</NavLink>
            <NavLink to="/owner/reports">Reports</NavLink>
            <span className="shared-muted">{user?.name}</span>
            <Button variant="ghost" onClick={logout}>Sign out</Button>
          </nav>
        </div>
      </header>
      <main className="shared-layout-main"><Outlet /></main>
      <footer className="shared-footer">Read-only business reporting</footer>
    </div>
  );
}
