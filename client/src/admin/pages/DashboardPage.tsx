import { Link } from 'react-router-dom';
import { useAdminMockStore } from '../components/AdminMockStore';
import { formatPrice } from '../components/format';
import { Badge, EmptyState, StatCard } from '../components/ui';

export function DashboardPage() {
  const { orders, products } = useAdminMockStore();
  const lowStock = products.flatMap((product) => product.variants
    .filter((variant) => variant.stock <= 5)
    .map((variant) => ({ product, variant })));
  const pendingOrders = orders.filter((order) => order.status === 'paid' || order.status === 'pending_payment').length;
  const revenue = orders.filter((order) => order.paymentStatus === 'paid')
    .reduce((total, order) => total + order.total, 0);
  const stats = [
    { label: 'Orders', value: String(orders.length), change: 'All demo orders' },
    { label: 'Paid revenue', value: formatPrice(revenue), change: 'Across listed orders' },
    { label: 'Pending orders', value: String(pendingOrders), change: 'Needs attention' },
    { label: 'Low-stock variants', value: String(lowStock.length), change: '5 units or fewer' },
  ];

  return (
    <div className="admin-stack">
      <div className="admin-page-heading"><div><h1>Dashboard</h1><p>Overview of store operations.</p></div></div>
      <div className="grid">{stats.map((item) => <StatCard key={item.label} {...item} />)}</div>
      <div className="panel">
        <div className="admin-section-heading"><h2>Recent orders</h2><Link to="/admin/orders">View all</Link></div>
        {orders.length ? <div className="admin-table-wrap"><table className="table">
          <thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Total</th></tr></thead>
          <tbody>{orders.slice(0, 5).map((order) => (
            <tr key={order.id}><td><Link to={`/admin/orders/${order.id}`}>{order.orderNumber}</Link></td>
              <td>{order.customerName}</td><td><Badge tone="success">{order.status.replace(/_/g, ' ')}</Badge></td><td>{formatPrice(order.total)}</td></tr>
          ))}</tbody>
        </table></div> : <EmptyState title="No orders yet" />}
      </div>
      <div className="panel">
        <div className="admin-section-heading"><h2>Low stock</h2><Link to="/admin/inventory">Manage inventory</Link></div>
        {lowStock.length ? <div className="admin-table-wrap"><table className="table">
          <thead><tr><th>Product</th><th>SKU</th><th>Size / color</th><th>Stock</th></tr></thead>
          <tbody>{lowStock.slice(0, 5).map(({ product, variant }) => (
            <tr key={variant.sku}><td>{product.name}</td><td>{variant.sku}</td><td>{variant.size} / {variant.color}</td><td><Badge tone="warning">{variant.stock}</Badge></td></tr>
          ))}</tbody>
        </table></div> : <EmptyState title="No low-stock items" />}
      </div>
    </div>
  );
}
