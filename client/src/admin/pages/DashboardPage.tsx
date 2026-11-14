import { Link } from 'react-router-dom';
import { useAuth } from '../../shared/auth/AuthContext';
import { useAdminDataStore } from '../components/AdminDataStore';
import { formatPrice } from '../components/format';
import { Badge, EmptyState } from '../components/ui';

const icons = {
  orders: <path d="M7 3.75h7l4.25 4.5v11A1.75 1.75 0 0 1 16.5 21h-9A1.75 1.75 0 0 1 5.75 19.25v-13A2.5 2.5 0 0 1 8.25 3.75Zm6.25.5v4.25h4" />,
  revenue: <><path d="M12 3.5v17" /><path d="M16.5 7.25c-.65-1.1-1.95-1.75-3.85-1.75-2.2 0-3.65 1.1-3.65 2.75 0 4.15 7.9 1.75 7.9 6.1 0 1.8-1.55 3.15-4.1 3.15-2.05 0-3.65-.8-4.5-2.15" /></>,
  pending: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></>,
  stock: <><path d="m4 8 8-4.5L20 8v8l-8 4.5L4 16V8Z" /><path d="m4.5 8.25 7.5 4.25 7.5-4.25M12 12.5v8" /></>,
} as const;

function MetricIcon({ name }: { name: keyof typeof icons }) {
  return <span className={`dashboard-metric__icon dashboard-metric__icon--${name}`} aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{icons[name]}</svg>
  </span>;
}

function orderStatusTone(status: string): 'success' | 'warning' | 'danger' | 'default' {
  if (status === 'paid' || status === 'delivered') return 'success';
  if (status === 'pending_payment' || status === 'requested') return 'warning';
  if (status === 'cancelled' || status === 'refunded' || status === 'rejected') return 'danger';
  return 'default';
}

export function DashboardPage() {
  const { user } = useAuth('staff');
  const { orders, products } = useAdminDataStore();
  const lowStock = products.flatMap((product) => product.variants
    .filter((variant) => variant.stock <= 5)
    .map((variant) => ({ product, variant })));
  const pendingOrders = orders.filter((order) => order.status === 'paid' || order.status === 'pending_payment').length;
  const revenue = orders.filter((order) => order.paymentStatus === 'paid')
    .reduce((total, order) => total + order.total, 0);
  const firstName = user?.name.trim().split(/\s+/)[0] || 'there';
  const date = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
  const stats = [
    { key: 'orders', label: 'Total orders', value: String(orders.length), note: 'Across all orders' },
    { key: 'revenue', label: 'Paid revenue', value: formatPrice(revenue), note: 'Successfully paid' },
    { key: 'pending', label: 'Needs attention', value: String(pendingOrders), note: 'Orders to process' },
    { key: 'stock', label: 'Low stock', value: String(lowStock.length), note: 'Variants with 5 or fewer' },
  ] as const;

  return (
    <main className="shared-admin-page dashboard-page">
      <header className="dashboard-welcome">
        <div className="dashboard-welcome__content">
          <span className="dashboard-eyebrow">STORE OVERVIEW <span /></span>
          <h1>Good day, {firstName}</h1>
          <p>Here’s what’s happening with your store today.</p>
        </div>
        <div className="dashboard-welcome__side">
          <span className="dashboard-date">{date}</span>
          <Link className="dashboard-primary-link" to="/admin/products/new"><span aria-hidden="true">＋</span> Add a product</Link>
        </div>
        <div className="dashboard-welcome__art" aria-hidden="true">
          <svg viewBox="0 0 250 190" fill="none">
            <path d="M71 125c18 4 33-1 48-15 10-9 19-17 30-20l24 23c11 10 25 15 39 15 12 0 20 9 20 20v8H44c-9 0-14-10-9-18 7-11 20-17 36-13Z" fill="currentColor" opacity=".16" />
            <path d="M81 123c14 1 26-4 39-16 9-9 18-16 28-19l22 21c10 10 24 15 39 15 12 0 20 8 20 19v9H48c-9 0-14-9-9-17 8-11 23-15 42-12Z" stroke="currentColor" strokeWidth="3" />
            <path d="m147 90 8 13m-20-5 8 13m-19-2 8 12M48 152h181" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            <circle cx="192" cy="50" r="23" stroke="currentColor" strokeWidth="2" opacity=".5" />
            <path d="M192 17v9m0 48v9m33-33h-9m-48 0h-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".5" />
          </svg>
        </div>
      </header>

      <section className="dashboard-metrics" aria-label="Store metrics">
        {stats.map((item) => (
          <article className="dashboard-metric" key={item.key}>
            <div className="dashboard-metric__top"><span>{item.label}</span><MetricIcon name={item.key} /></div>
            <strong className="dashboard-metric__value">{item.value}</strong>
            <span className="dashboard-metric__note">{item.note}</span>
          </article>
        ))}
      </section>

      <div className="dashboard-section-heading">
        <div><span className="dashboard-section-kicker">AT A GLANCE</span><h2>Store activity</h2></div>
        <span className="dashboard-live-label"><span /> Live overview</span>
      </div>

      <div className="dashboard-panels">
        <section className="dashboard-panel dashboard-orders">
          <header className="dashboard-panel__heading">
            <div><span className="dashboard-panel__icon" aria-hidden="true">↗</span><div><h2>Recent orders</h2><p>Your latest customer purchases</p></div></div>
            <Link to="/admin/orders">View all <span aria-hidden="true">→</span></Link>
          </header>
          {orders.length ? (
            <div className="dashboard-table-wrap"><table className="dashboard-table">
              <thead><tr><th>Order</th><th>Customer</th><th>Status</th><th className="is-right">Total</th></tr></thead>
              <tbody>{orders.slice(0, 5).map((order) => (
                <tr key={order.id}>
                  <td><Link className="dashboard-order-id" to={`/admin/orders/${order.id}`}>{order.orderNumber}</Link></td>
                  <td><span className="dashboard-customer">{order.customerName}</span></td>
                  <td><Badge tone={orderStatusTone(order.status)}>{order.status.replace(/_/g, ' ')}</Badge></td>
                  <td className="is-right dashboard-amount">{formatPrice(order.total)}</td>
                </tr>
              ))}</tbody>
            </table></div>
          ) : <EmptyState title="No orders yet" />}
        </section>

        <section className="dashboard-panel dashboard-stock">
          <header className="dashboard-panel__heading">
            <div><span className="dashboard-panel__icon dashboard-panel__icon--amber" aria-hidden="true">!</span><div><h2>Stock to replenish</h2><p>Products running low</p></div></div>
            <Link to="/admin/inventory">Inventory <span aria-hidden="true">→</span></Link>
          </header>
          {lowStock.length ? (
            <div className="dashboard-stock-list">
              {lowStock.slice(0, 5).map(({ product, variant }) => (
                <div className="dashboard-stock-row" key={variant.sku}>
                  <span className="dashboard-stock-product"><strong>{product.name}</strong><small>{variant.size} / {variant.color} · {variant.sku}</small></span>
                  <span className={`dashboard-stock-count${variant.stock === 0 ? ' is-empty' : ''}`}>{variant.stock}<small>left</small></span>
                </div>
              ))}
            </div>
          ) : <EmptyState title="Stock looks good" description="No variants need restocking right now." />}
        </section>
      </div>
    </main>
  );
}
