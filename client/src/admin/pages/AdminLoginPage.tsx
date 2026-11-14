import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../shared/auth/AuthContext';
import { ApiClientError } from '../../shared/api/client';
import { Button, Input } from '../../shared/ui';
import './admin-login.css';

export function AdminLoginPage() {
  const { login, logout, user, isLoading } = useAuth('staff');
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isLoading) return <div className="admin-login-loading" role="status">Checking your session…</div>;
  if (user?.role === 'admin') return <Navigate to="/admin" replace />;
  if (user?.role === 'owner') return <Navigate to="/owner" replace />;
  if (user) {
    return (
      <main className="admin-login-page">
        <section className="admin-login-card">
          <Link className="admin-login-brand" to="/">SHOE STORE <span>ADMIN</span></Link>
          <div className="admin-login-icon" aria-hidden="true">!</div>
          <h1>Staff access only</h1>
          <p>You’re currently signed in with a customer account. Sign out before using an administrator or owner account.</p>
          <Button type="button" onClick={() => logout()}>Sign out</Button>
          <Link className="admin-login-back" to="/">Return to the store</Link>
        </section>
      </main>
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const signedInUser = await login(email, password);
      navigate(signedInUser.role === 'owner' ? '/owner' : '/admin', { replace: true });
    } catch (loginError) {
      setError(loginError instanceof ApiClientError && loginError.status === 403
        ? loginError.message
        : 'Email or password is incorrect.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="admin-login-page">
      <section className="admin-login-card">
        <Link className="admin-login-brand" to="/">SHOE STORE <span>ADMIN</span></Link>
        <div className="admin-login-icon" aria-hidden="true">S</div>
        <p className="admin-login-eyebrow">ADMINISTRATION PORTAL</p>
        <h1>Welcome back</h1>
        <p className="admin-login-description">Sign in with your administrator or owner account to manage the store.</p>
        <form onSubmit={submit}>
          <label>
            Staff email
            <Input required type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            Password
            <Input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {error && <p className="admin-login-error" role="alert">{error}</p>}
          <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Signing in…' : 'Sign in to staff portal'}</Button>
        </form>
        <Link className="admin-login-back" to="/">← Back to the store</Link>
      </section>
      <p className="admin-login-footer">Authorized staff only</p>
    </main>
  );
}
