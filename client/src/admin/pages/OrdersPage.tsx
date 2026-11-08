import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import type { OrderStatus } from '../../shared/types';
import type { Order } from '../../shared/types';
import { formatPrice } from '../components/format';
import { EmptyState, Section } from '../components/ui';

const statuses: OrderStatus[] = ['pending_payment', 'paid', 'packed', 'shipped', 'delivered', 'cancelled', 'refunded'];

export function OrdersPage() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const params = useMemo(() => ({
    page: 1,
    limit: 100,
    ...(query.trim() ? { q: query.trim() } : {}),
    ...(status ? { status } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  }), [query, status, from, to]);
  const ordersQuery = useQuery({
    queryKey: ['admin', 'orders', params],
    queryFn: () => api.get<Order[]>('/admin/orders', { params }),
  });
  const orders = ordersQuery.data?.data ?? [];

  return (
    <Section title="Orders">
      <div className="admin-toolbar">
        <input aria-label="Search orders" placeholder="Order number or customer" value={query} onChange={(event) => setQuery(event.target.value)} />
        <select aria-label="Filter orders by status" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>{statuses.map((value) => <option key={value} value={value}>{value.replace(/_/g, ' ')}</option>)}
        </select>
        <label className="admin-inline-label">From<input aria-label="From date" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label className="admin-inline-label">To<input aria-label="To date" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
      </div>
      {ordersQuery.isLoading && <p role="status">Loading orders…</p>}
      {ordersQuery.isError && <p role="alert">{ordersQuery.error.message} <button className="button ghost" type="button" onClick={() => void ordersQuery.refetch()}>Retry</button></p>}
      {orders.length ? (
        <div className="admin-table-wrap"><table className="table">
          <thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Status</th><th>Payment</th><th>Total</th></tr></thead>
          <tbody>{orders.map((order) => (
            <tr key={order.id}>
              <td><Link to={`/admin/orders/${order.id}`}>{order.orderNumber}</Link></td>
              <td>{order.customerName}</td>
              <td>{new Date(order.createdAt).toLocaleDateString()}</td>
              <td><span className="badge warning">{order.status.replace(/_/g, ' ')}</span></td>
              <td>{order.paymentStatus.replace(/_/g, ' ')}</td>
              <td>{formatPrice(order.total)}</td>
            </tr>
          ))}</tbody>
        </table></div>
      ) : <EmptyState title="No matching orders" description="Change the filters to see other orders." />}
    </Section>
  );
}
