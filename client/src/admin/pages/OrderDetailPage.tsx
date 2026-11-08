import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import { useToast } from '../../shared/ui';
import type { Order, OrderStatus } from '../../shared/types';
import { useAdminMockStore } from '../components/AdminMockStore';
import { formatPrice } from '../components/format';
import { Section } from '../components/ui';

const nextStatuses: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ['paid', 'cancelled'],
  paid: ['packed', 'cancelled', 'refunded'],
  packed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: ['refunded'],
  cancelled: [],
  refunded: [],
};

export function OrderDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { refreshAdminData } = useAdminMockStore();
  const orderQuery = useQuery({
    queryKey: ['admin', 'order', id],
    queryFn: () => api.get<Order>(`/admin/orders/${encodeURIComponent(id ?? '')}`),
    enabled: Boolean(id),
  });
  const order = orderQuery.data?.data;
  const [nextStatus, setNextStatus] = useState<OrderStatus | ''>('');
  const [note, setNote] = useState('');

  async function updateStatus() {
    if (!order || !nextStatus || !nextStatuses[order.status].includes(nextStatus)) return;
    try {
      const { data } = await api.patch<typeof order>(`/admin/orders/${encodeURIComponent(order.id)}/status`, {
        status: nextStatus,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      queryClient.setQueryData(['admin', 'order', id], { data });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      await refreshAdminData();
      setNextStatus('');
      setNote('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update order status.');
    }
  }

  if (orderQuery.isLoading) return <Section title="Loading order"><p role="status">Loading order details…</p></Section>;
  if (orderQuery.isError) return <Section title="Unable to load order"><p role="alert">{orderQuery.error.message}</p><button className="button" type="button" onClick={() => void orderQuery.refetch()}>Retry</button></Section>;
  if (!order) {
    return <Section title="Order not found"><p>This order is unavailable.</p><Link to="/admin/orders">Back to orders</Link></Section>;
  }

  return (
    <div className="admin-stack">
      <Section title={`Order ${order.orderNumber}`}>
        <div className="admin-toolbar">
          <Link className="button ghost" to="/admin/orders">Back to orders</Link>
          <button className="button" type="button" onClick={() => window.print()}>Print invoice</button>
        </div>
        <div className="admin-detail-grid">
          <div><h3>Customer</h3><p>{order.customerName}<br />{order.customerEmail}</p></div>
          <div><h3>Delivery address</h3><p>{order.shippingAddress.recipient}<br />{order.shippingAddress.street}, {order.shippingAddress.city}<br />{order.shippingAddress.state} · {order.shippingAddress.phone}</p></div>
          <div><h3>Payment</h3><p>{order.paymentMethod.replace(/_/g, ' ')} · {order.paymentStatus.replace(/_/g, ' ')}</p></div>
          <div><h3>Status</h3><p><span className="badge warning">{order.status.replace(/_/g, ' ')}</span></p></div>
        </div>
        <div className="admin-table-wrap"><table className="table">
          <thead><tr><th>Item</th><th>SKU</th><th>Size / color</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead>
          <tbody>{order.items.map((item) => <tr key={item.sku}>
            <td>{item.name}</td><td>{item.sku}</td><td>{item.size} / {item.color}</td><td>{item.quantity}</td>
            <td>{formatPrice(item.unitPrice)}</td><td>{formatPrice(item.unitPrice * item.quantity)}</td>
          </tr>)}</tbody>
          <tfoot>
            <tr><th colSpan={5}>Subtotal</th><td>{formatPrice(order.subtotal)}</td></tr>
            <tr><th colSpan={5}>Discount</th><td>−{formatPrice(order.discountAmount)}</td></tr>
            <tr><th colSpan={5}>Delivery</th><td>{formatPrice(order.deliveryFee)}</td></tr>
            <tr><th colSpan={5}>Total</th><td><strong>{formatPrice(order.total)}</strong></td></tr>
          </tfoot>
        </table></div>
      </Section>
      <Section title="Update order status">
        {nextStatuses[order.status].length ? (
          <div className="admin-toolbar">
            <select aria-label="Next order status" value={nextStatus} onChange={(event) => setNextStatus(event.target.value as OrderStatus)}>
              <option value="">Select next status</option>{nextStatuses[order.status].map((status) => <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>)}
            </select>
            <input aria-label="Status note" placeholder="Optional note" value={note} onChange={(event) => setNote(event.target.value)} />
            <button className="button" type="button" disabled={!nextStatus} onClick={() => void updateStatus()}>Update status</button>
          </div>
        ) : <p>This order is in a final status and cannot be changed.</p>}
        <ol className="admin-history">{order.statusHistory.map((entry, index) => (
          <li key={`${entry.at}-${index}`}><strong>{entry.status.replace(/_/g, ' ')}</strong> · {new Date(entry.at).toLocaleString()}{entry.note ? ` — ${entry.note}` : ''}</li>
        ))}</ol>
      </Section>
    </div>
  );
}
