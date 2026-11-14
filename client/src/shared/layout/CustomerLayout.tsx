import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { resolveAssetUrl } from '../lib/assetUrl';
import { cartQueryKey, loadCart } from '../../customer/guestCart';

export function CustomerLayout() {
  const { user, logout } = useAuth('customer');
  const navigate = useNavigate();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const cartQuery = useQuery({
    queryKey: cartQueryKey(user?.role === 'customer' ? user.id : undefined),
    queryFn: () => user?.role === 'customer' ? loadCart(user.id) : loadCart(),
  });
  const cartCount = cartQuery.data?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;

  useEffect(() => {
    function closeOnOutsideClick(event: PointerEvent) {
      if (!accountMenuRef.current?.contains(event.target as Node)) setAccountMenuOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setAccountMenuOpen(false);
    }
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

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
            {(!user || user.role === 'customer') && (
              <NavLink to="/cart" aria-label={`Cart, ${cartCount} items`}>Cart <span className="ui-badge ui-badge-neutral">{cartCount}</span></NavLink>
            )}
            <div className="account-dropdown" ref={accountMenuRef}>
              <button
                type="button"
                className={`account-dropdown__trigger${user ? ' has-user' : ''}`}
                aria-expanded={accountMenuOpen}
                aria-haspopup="true"
                aria-controls="account-dropdown-menu"
                onClick={() => setAccountMenuOpen((open) => !open)}
              >
                {user
                  ? user.avatarUrl
                    ? <img className="account-dropdown__avatar" src={resolveAssetUrl(user.avatarUrl)} alt="" />
                    : <span className="account-dropdown__avatar account-dropdown__initials" aria-hidden="true">{user.name.trim().charAt(0).toUpperCase()}</span>
                  : <span>Sign in</span>}
                <span className="account-dropdown__chevron" aria-hidden="true">⌄</span>
              </button>
              {accountMenuOpen && (
                <div className="account-dropdown__menu" id="account-dropdown-menu">
                  {user ? (
                    <>
                      <div className="account-dropdown__identity">
                        <strong>{user.name}</strong>
                        <span>{user.email}</span>
                      </div>
                      <Link to="/account/profile" onClick={() => setAccountMenuOpen(false)}>Profile</Link>
                      <button type="button" onClick={() => { logout(); setAccountMenuOpen(false); navigate('/'); }}>Log out</button>
                    </>
                  ) : (
                    <Link to="/login" onClick={() => setAccountMenuOpen(false)}>Log in</Link>
                  )}
                </div>
              )}
            </div>
          </nav>
        </div>
      </header>
      <main className="shared-layout-main"><Outlet /></main>
      <footer className="shared-footer">Thoughtfully selected footwear for every step.</footer>
    </div>
  );
}
