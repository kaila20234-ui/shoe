import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../../shared/api/client';
import { formatDate, formatNaira } from '../../shared/lib/format';
import { Button, Select } from '../../shared/ui';
import type { ReportSummary, TopProduct } from '../../shared/types';
import { LoadingState, PageHeading, QueryError } from './shared';

const now = new Date();
const defaultTo = now.toISOString().slice(0, 10);
const defaultFrom = new Date(now.getTime() - 6 * 86400000).toISOString().slice(0, 10);

export function OwnerOverviewPage() {
  const [period, setPeriod] = useState<ReportSummary['period']>('daily');
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const summaryQuery = useQuery({
    queryKey: ['owner', 'summary', period, from, to],
    queryFn: async () => (await api.get<ReportSummary>('/owner/reports/summary', { params: { period, from, to } })).data,
  });
  const productsQuery = useQuery({
    queryKey: ['owner', 'top-products', from, to],
    queryFn: async () => (await api.get<TopProduct[]>('/owner/reports/top-products', { params: { from, to, limit: 5 } })).data,
  });
  const summary = summaryQuery.data;

  return (
    <div className="shared-page">
      <PageHeading title="Business overview" description="A read-only view of sales, orders and refunds." />
      <section className="shared-filters no-print" aria-label="Report filters">
        <div className="shared-field"><label htmlFor="overview-period">Period</label><Select id="overview-period" value={period} onChange={(event) => setPeriod(event.target.value as ReportSummary['period'])}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></Select></div>
        <div className="shared-field"><label htmlFor="overview-from">From</label><input id="overview-from" className="ui-input" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></div>
        <div className="shared-field"><label htmlFor="overview-to">To</label><input id="overview-to" className="ui-input" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></div>
        <Button variant="secondary" onClick={() => window.print()}>Print / Save PDF</Button>
      </section>
      {summaryQuery.isLoading && <LoadingState />}
      {summaryQuery.isError && <QueryError error={summaryQuery.error} retry={() => void summaryQuery.refetch()} />}
      {summary && <>
        <section className="shared-grid" aria-label="Key performance indicators">
          <Kpi label="Revenue" value={formatNaira(summary.totals.revenue)} />
          <Kpi label="Orders" value={summary.totals.orders.toLocaleString('en-NG')} />
          <Kpi label="Refunds" value={formatNaira(summary.totals.refunds)} />
          <Kpi label="Average order value" value={formatNaira(summary.totals.averageOrderValue)} />
        </section>
        <section className="shared-card" style={{ marginTop: 18 }}>
          <h2>Revenue and orders</h2>
          <div className="shared-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={summary.series} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7ece8" />
                <XAxis dataKey="date" tickFormatter={(value: string) => formatDate(value)} minTickGap={24} />
                <YAxis yAxisId="revenue" tickFormatter={(value: number) => `₦${Math.round(value / 100000)}k`} />
                <YAxis yAxisId="orders" orientation="right" allowDecimals={false} />
                <Tooltip formatter={(value: number, name: string) => name === 'Revenue' ? formatNaira(value) : value} />
                <Line yAxisId="revenue" type="monotone" dataKey="revenue" name="Revenue" stroke="#173f32" strokeWidth={3} dot={false} />
                <Line yAxisId="orders" type="monotone" dataKey="orders" name="Orders" stroke="#c87943" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </>}
      <section className="shared-card" style={{ marginTop: 18 }}>
        <h2>Top products</h2>
        {productsQuery.isLoading && <LoadingState label="Loading top products" />}
        {productsQuery.isError && <QueryError error={productsQuery.error} retry={() => void productsQuery.refetch()} />}
        {productsQuery.data && (productsQuery.data.length
          ? <ol className="shared-list">{productsQuery.data.map((item) => <li key={item.productId}><span><strong>{item.name}</strong><br /><small className="shared-muted">{item.unitsSold} sold</small></span><strong>{formatNaira(item.revenue)}</strong></li>)}</ol>
          : <p className="shared-muted">No product sales in this period.</p>)}
      </section>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return <article className="shared-card"><div className="shared-muted">{label}</div><div className="shared-total">{value}</div></article>;
}
