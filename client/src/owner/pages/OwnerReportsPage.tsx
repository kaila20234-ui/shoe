import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import { formatDateTime, formatNaira } from '../../shared/lib/format';
import { Button, DataTable, Input, Pagination, Select, type TableColumn } from '../../shared/ui';
import type { AuditLog, PageMeta, ReportSummary, TopProduct } from '../../shared/types';
import { LoadingState, PageHeading, QueryError } from './shared';

const emptyMeta: PageMeta = { page: 1, limit: 20, total: 0, totalPages: 0 };
const today = new Date().toISOString().slice(0, 10);
const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

export function OwnerReportsPage() {
  const [period, setPeriod] = useState<ReportSummary['period']>('monthly');
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState('');
  const [actorId, setActorId] = useState('');
  const summaryQuery = useQuery({
    queryKey: ['owner', 'reports-summary', period, from, to],
    queryFn: async () => (await api.get<ReportSummary>('/owner/reports/summary', { params: { period, from, to } })).data,
  });
  const productsQuery = useQuery({
    queryKey: ['owner', 'reports-products', from, to],
    queryFn: async () => (await api.get<TopProduct[]>('/owner/reports/top-products', { params: { from, to, limit: 5 } })).data,
  });
  const auditParams = useMemo(() => ({
    page,
    limit: 20,
    from,
    to,
    ...(entity ? { entity } : {}),
    ...(actorId ? { actorId } : {}),
  }), [page, from, to, entity, actorId]);
  const auditQuery = useQuery({
    queryKey: ['owner', 'audit-logs', auditParams],
    queryFn: async () => api.get<AuditLog[]>('/audit-logs', { params: auditParams }),
  });
  const logs = auditQuery.data?.data ?? [];
  const meta = auditQuery.data?.meta ?? emptyMeta;
  const columns = useMemo<TableColumn<AuditLog>[]>(() => [
    { key: 'date', header: 'Date', render: (log) => formatDateTime(log.createdAt) },
    { key: 'actor', header: 'Actor', render: (log) => <>{log.actorName}<br /><small>{log.actorRole}</small></> },
    { key: 'action', header: 'Action', render: (log) => log.action.replace(/\./g, ' ') },
    { key: 'entity', header: 'Entity', render: (log) => `${log.entity} · ${log.entityId}` },
  ], []);

  return (
    <div className="shared-page">
      <PageHeading title="Reports" description="Sales summaries and the audit trail are available for review only.">
        <Button className="no-print" variant="secondary" onClick={() => window.print()}>Print / Save PDF</Button>
      </PageHeading>
      <section className="shared-filters no-print">
        <div className="shared-field"><label htmlFor="report-period">Period</label><Select id="report-period" value={period} onChange={(event) => setPeriod(event.target.value as ReportSummary['period'])}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></Select></div>
        <div className="shared-field"><label htmlFor="report-from">From</label><Input id="report-from" type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} /></div>
        <div className="shared-field"><label htmlFor="report-to">To</label><Input id="report-to" type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} /></div>
      </section>
      {summaryQuery.isLoading && <LoadingState />}
      {summaryQuery.isError && <QueryError error={summaryQuery.error} retry={() => void summaryQuery.refetch()} />}
      {summaryQuery.data && (
        <section className="shared-card">
          <h2>Period totals</h2>
          <div className="shared-grid">
            <ReportTotal label="Revenue" value={formatNaira(summaryQuery.data.totals.revenue)} />
            <ReportTotal label="Orders" value={summaryQuery.data.totals.orders.toLocaleString('en-NG')} />
            <ReportTotal label="Refunds" value={formatNaira(summaryQuery.data.totals.refunds)} />
            <ReportTotal label="Average order value" value={formatNaira(summaryQuery.data.totals.averageOrderValue)} />
          </div>
        </section>
      )}
      <section className="shared-card" style={{ marginTop: 18 }}>
        <h2>Top products</h2>
        {productsQuery.isLoading && <LoadingState />}
        {productsQuery.isError && <QueryError error={productsQuery.error} retry={() => void productsQuery.refetch()} />}
        {productsQuery.data && <DataTable columns={[
          { key: 'name', header: 'Product', render: (item) => item.name },
          { key: 'units', header: 'Units sold', render: (item) => item.unitsSold },
          { key: 'revenue', header: 'Revenue', render: (item) => formatNaira(item.revenue) },
        ]} rows={productsQuery.data} getRowKey={(item) => item.productId} emptyMessage="No product sales for this period." />}
      </section>
      <section className="shared-card" style={{ marginTop: 18 }}>
        <h2>Audit log</h2>
        <div className="shared-filters no-print">
          <div className="shared-field"><label htmlFor="audit-entity">Entity</label><Select id="audit-entity" value={entity} onChange={(event) => { setEntity(event.target.value); setPage(1); }}><option value="">All entities</option><option value="order">Order</option><option value="product">Product</option><option value="discount">Discount</option><option value="delivery_zone">Delivery zone</option><option value="review">Review</option><option value="return">Return</option><option value="user">User</option></Select></div>
          <div className="shared-field"><label htmlFor="audit-actor">Actor ID</label><Input id="audit-actor" value={actorId} onChange={(event) => { setActorId(event.target.value); setPage(1); }} placeholder="Filter by actor" /></div>
        </div>
        {auditQuery.isLoading && <LoadingState />}
        {auditQuery.isError && <QueryError error={auditQuery.error} retry={() => void auditQuery.refetch()} />}
        {auditQuery.data && <>
          <DataTable columns={columns} rows={logs} getRowKey={(log) => log.id} emptyMessage="No audit log entries found." />
          <Pagination page={meta.page} totalPages={meta.totalPages} onChange={setPage} />
        </>}
      </section>
    </div>
  );
}

function ReportTotal({ label, value }: { label: string; value: string }) {
  return <article><span className="shared-muted">{label}</span><div className="shared-total">{value}</div></article>;
}
