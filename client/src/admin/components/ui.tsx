import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function StatCard({ label, value, change }: { label: string; value: string; change: string }) {
  return (
    <div className="stat-card">
      <div className="meta">{label}</div>
      <div className="value">{value}</div>
      <div className="change">{change}</div>
    </div>
  );
}

export function Badge({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'success' | 'warning' | 'danger' }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function Button({
  children,
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  return <button type="button" className={`button ${variant}`} {...props}>{children}</button>;
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="panel">
      <div className="panel-title">{title}</div>
      {children}
    </section>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
    </div>
  );
}
