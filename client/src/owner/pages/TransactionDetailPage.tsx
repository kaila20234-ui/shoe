import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import { formatDateTime, formatNaira } from '../../shared/lib/format';
import { Button, StatusBadge } from '../../shared/ui';
import type { Order, Transaction } from '../../shared/types';
import { LoadingState, PageHeading, QueryError } from './shared';

interface TransactionDetail {
  transaction: Transaction;
  order: Order;
}

export function TransactionDetailPage() {
  const { id = '' } = useParams();
  const detailQuery = useQuery({
    queryKey: ['owner', 'transaction', id],
    queryFn: async () => (await api.get<TransactionDetail>(`/owner/transactions/${encodeURIComponent(id)}`)).data,
    enabled: Boolean(id),
  });
  const detail = detailQuery.data;

  return (
    <div className="shared-page">
      <PageHeading title="Transaction details" description="Payment and linked order information, view only.">
        <div className="shared-inline no-print"><Link to="/owner/transactions">Back to transactions</Link><Button variant="secondary" onClick={() => window.print()}>Print</Button></div>
      </PageHeading>
      {detailQuery.isLoading && <LoadingState />}
      {detailQuery.isError && <QueryError error={detailQuery.error} retry={() => void detailQuery.refetch()} />}
      {detail && <>
        <section className="shared-grid">
          <article className="shared-card"><span className="shared-muted">Reference</span><h2>{detail.transaction.reference}</h2><StatusBadge status={detail.transaction.status} /></article>
          <article className="shared-card"><span className="shared-muted">Amount</span><div className="shared-total">{formatNaira(detail.transaction.amount)}</div></article>
          <article className="shared-card"><span className="shared-muted">Payment method</span><h2>{detail.transaction.method.replace(/_/g, ' ')}</h2><span className="shared-muted">{formatDateTime(detail.transaction.createdAt)}</span></article>
        </section>
        <section className="shared-card" style={{ marginTop: 18 }}>
          <h2>Order {detail.order.orderNumber}</h2>
          <div className="shared-grid">
            <div><strong>Customer</strong><p>{detail.order.customerName}<br />{detail.order.customerEmail}</p></div>
            <div><strong>Shipping address</strong><p>{detail.order.shippingAddress.recipient}<br />{detail.order.shippingAddress.street}, {detail.order.shippingAddress.city}, {detail.order.shippingAddress.state}<br />{detail.order.shippingAddress.phone}</p></div>
            <div><strong>Order status</strong><p><StatusBadge status={detail.order.status} /></p><strong>Payment status</strong><p><StatusBadge status={detail.order.paymentStatus} /></p></div>
          </div>
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead><tr><th>Item</th><th>SKU</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead>
              <tbody>{detail.order.items.map((item) => <tr key={item.sku}><td>{item.name}<br /><small>{item.color}, size {item.size}</small></td><td>{item.sku}</td><td>{item.quantity}</td><td>{formatNaira(item.unitPrice)}</td><td>{formatNaira(item.unitPrice * item.quantity)}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="shared-stack" style={{ maxWidth: 360, margin: '18px 0 0 auto' }}>
            <TotalRow label="Subtotal" amount={detail.order.subtotal} />
            <TotalRow label="Discount" amount={-detail.order.discountAmount} />
            <TotalRow label="Delivery" amount={detail.order.deliveryFee} />
            <TotalRow label="Total" amount={detail.order.total} strong />
          </div>
        </section>
        <section className="shared-card" style={{ marginTop: 18 }}>
          <h2>Status history</h2>
          <ol className="shared-list">{detail.order.statusHistory.map((entry, index) => <li key={`${entry.status}-${entry.at}-${index}`}><span><strong>{entry.status.replace(/_/g, ' ')}</strong>{entry.note && <><br /><small>{entry.note}</small></>}</span><time>{formatDateTime(entry.at)}</time></li>)}</ol>
        </section>
      </>}
    </div>
  );
}

function TotalRow({ label, amount, strong = false }: { label: string; amount: number; strong?: boolean }) {
  return <div className="shared-inline" style={{ justifyContent: 'space-between', fontWeight: strong ? 750 : 400 }}><span>{label}</span><span>{formatNaira(amount)}</span></div>;
}
