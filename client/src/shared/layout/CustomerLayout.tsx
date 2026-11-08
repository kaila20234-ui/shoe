import { Link, NavLink, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';
import type { Cart } from '../types';

export function CustomerLayout() {
  const { user } = useAuth();
  const cartQuery = useQuery({
    queryKey: ['cart', 'nav'],
    queryFn: async () => (await api.get<Cart>('/cart')).data,
    enabled: user?.role === 'customer',
  });
  const cartCount = cartQuery.data?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;

  return (
    <div className="shared-layout">
      <header className="shared-nav">
        <div className="shared-nav-inner">
          <Link className="shared-brand" to="/">SHOE STORE</Link>
          <nav className="shared-nav-links" aria-label="Main navigation">
            <NavLink to="/shop">Shop</NavLink>
            <NavLink to="/shop?audience=men">Men</NavLink>
            <NavLink to="/shop?audience=women">Women</NavLink>
            <NavLink to="/shop?audience=kids">Kids</NavLink>
            <NavLink to="/cart" aria-label={`Cart, ${cartCount} items`}>Cart <span className="ui-badge ui-badge-neutral">{cartCount}</span></NavLink>
            <NavLink to={user ? '/account' : '/login'}>{user ? 'Account' : 'Sign in'}</NavLink>
          </nav>
        </div>
      </header>
      <main className="shared-layout-main"><Outlet /></main>
      <footer className="shared-footer">Thoughtfully selected footwear for every step.</footer>
    </div>
  );
}
