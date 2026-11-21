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
  const [newsletterSubscribed, setNewsletterSubscribed] = useState(false);
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
      <footer className="shared-footer">
        <div className="shared-footer__main">
          <div className="shared-footer__brand">
            <Link className="shared-footer__brand-name" to="/">SHOE STORE</Link>
            <p>Thoughtfully selected footwear for every step, every style, and every day.</p>
            <div className="shared-footer__social" aria-label="Social links">
              <a href="https://www.instagram.com/" target="_blank" rel="noreferrer" aria-label="Instagram">
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.4" cy="6.6" r="1" fill="currentColor" stroke="none"/></svg>
              </a>
              <a href="https://www.facebook.com/" target="_blank" rel="noreferrer" aria-label="Facebook">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 8.5V7.2c0-.7.5-.9 1-.9h2V3h-2.8C11 3 10 5.2 10 7v1.5H7V12h3v9h4v-9h3l.5-3.5H14Z" fill="currentColor" stroke="none"/></svg>
              </a>
              <a href="https://www.tiktok.com/" target="_blank" rel="noreferrer" aria-label="TikTok">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 3c.2 2.2 1.5 3.7 3.5 4.1v3.2a8 8 0 0 1-3.5-1v5.8a5.4 5.4 0 1 1-5.4-5.4c.4 0 .8 0 1.2.1v3.3a2.2 2.2 0 1 0 1.2 2V3h3Z" fill="currentColor" stroke="none"/></svg>
              </a>
            </div>
          </div>
          <div className="shared-footer__column">
            <h2>Shop</h2>
            <Link to="/shop">All shoes</Link>
            <Link to="/shop?audience=men">Men</Link>
            <Link to="/shop?audience=women">Women</Link>
            <Link to="/shop?audience=kids">Kids</Link>
          </div>
          <div className="shared-footer__column">
            <h2>Discover</h2>
            <Link to="/shop?sort=newest">New arrivals</Link>
            <Link to="/shop?sort=rating">Customer favorites</Link>
            <Link to="/shop">All shoes</Link>
          </div>
          <div className="shared-footer__column">
            <h2>Customer Service</h2>
            <Link to="/contact-us">Contact Us</Link>
            <Link to="/complaints">Submit a complaint</Link>
            <Link to="/shipping-info">Shipping Info</Link>
            <Link to="/returns-exchanges">Returns &amp; Exchanges</Link>
            <Link to="/faqs">FAQs</Link>
            <Link to="/privacy-policy">Privacy Policy</Link>
          </div>
          <div className="shared-footer__newsletter">
            <span className="shared-footer__eyebrow">The latest drop</span>
            <h2>Good shoes. Good news.</h2>
            <p>Join our list for new arrivals and special offers.</p>
            {newsletterSubscribed ? (
              <div className="shared-footer__success" role="status">You're on the list. Welcome!</div>
            ) : (
              <form
                className="shared-footer__form"
                onSubmit={(event) => {
                  event.preventDefault();
                  setNewsletterSubscribed(true);
                }}
              >
                <label className="sr-only" htmlFor="footer-email">Email address</label>
                <input id="footer-email" name="email" type="email" placeholder="Email address" required />
                <button type="submit" aria-label="Subscribe">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                </button>
              </form>
            )}
          </div>
        </div>
        <div className="shared-footer__bottom">
          <span>&copy; {new Date().getFullYear()} Shoe Store. All rights reserved.</span>
          <div>
            <Link to="/privacy-policy">Privacy Policy</Link>
            <span>Terms</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
