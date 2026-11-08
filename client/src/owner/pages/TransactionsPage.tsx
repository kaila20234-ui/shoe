import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import { formatDateTime, formatNaira } from '../../shared/lib/format';
import { Button, DataTable, Input, Pagination, Select, StatusBadge, useToast, type TableColumn } from '../../shared/ui';
import type { PageMeta, Transaction } from '../../shared/types';
import { LoadingState, PageHeading, QueryError } from './shared';

const emptyMeta: PageMeta = { page: 1, limit: 20, total: 0, totalPages: 0 };

export function TransactionsPage() {
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('');
  const [method, setMethod] = useState('');
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();
  const params = useMemo(() => ({
    page,
    limit: 20,
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(status ? { status } : {}),
    ...(method ? { method } : {}),
    ...(search.trim() ? { q: search.trim() } : {}),
  }), [page, from, to, status, method, search]);
  const transactionsQuery = useQuery({
    queryKey: ['owner', 'transactions', params],
    queryFn: async () => api.get<Transaction[]>('/owner/transactions', { params }),
  });
  const rows = transactionsQuery.data?.data ?? [];
  const meta = transactionsQuery.data?.meta ?? emptyMeta;
  const columns = useMemo<TableColumn<Transaction>[]>(() => [
    { key: 'date', header: 'Date', render: (row) => formatDateTime(row.createdAt) },
    { key: 'reference', header: 'Reference', render: (row) => row.reference },
    { key: 'order', header: 'Order', render: (row) => row.orderNumber },
    { key: 'customer', header: 'Customer', render: (row) => row.customerName },
    { key: 'method', header: 'Method', render: (row) => row.method.replace(/_/g, ' ') },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'amount', header: 'Amount', render: (row) => <strong>{formatNaira(row.amount)}</strong> },
  ], []);

  async function exportCsv() {
    setExporting(true);
    try {
      const blob = await api.getBlob('/owner/transactions/export', {
        params: {
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
          ...(status ? { status } : {}),
          ...(method ? { method } : {}),
          ...(search.trim() ? { q: search.trim() } : {}),
          format: 'csv',
        },
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'shoe-store-transactions.csv';
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to export transactions.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="shared-page">
      <PageHeading title="Transactions" description="Search and review payment activity. Records are read-only.">
        <div className="shared-inline no-print">
          <Button variant="secondary" disabled={exporting} onClick={() => void exportCsv()}>{exporting ? 'Preparing CSV…' : 'Export CSV'}</Button>
          <Button variant="secondary" onClick={() => window.print()}>Export PDF</Button>
        </div>
      </PageHeading>
      <section className="shared-filters no-print" aria-label="Transaction filters">
        <div className="shared-field"><label htmlFor="txn-from">From</label><Input id="txn-from" type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} /></div>
        <div className="shared-field"><label htmlFor="txn-to">To</label><Input id="txn-to" type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} /></div>
        <div className="shared-field"><label htmlFor="txn-status">Status</label><Select id="txn-status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">All statuses</option><option value="pending">Pending</option><option value="success">Success</option><option value="failed">Failed</option><option value="refunded">Refunded</option></Select></div>
        <div className="shared-field"><label htmlFor="txn-method">Method</label><Select id="txn-method" value={method} onChange={(event) => { setMethod(event.target.value); setPage(1); }}><option value="">All methods</option><option value="paystack">Paystack</option><option value="pay_on_delivery">Pay on delivery</option></Select></div>
        <div className="shared-field" style={{ flex: '1 1 200px' }}><label htmlFor="txn-search">Search</label><Input id="txn-search" value={search} placeholder="Reference, order or customer" onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></div>
      </section>
      {transactionsQuery.isLoading && <LoadingState />}
      {transactionsQuery.isError && <QueryError error={transactionsQuery.error} retry={() => void transactionsQuery.refetch()} />}
      {transactionsQuery.data && <>
        <p className="shared-muted">Showing {rows.length} of {meta.total} transactions</p>
        <DataTable columns={columns} rows={rows} getRowKey={(row) => row.id} onRowClick={(row) => navigate(`/owner/transactions/${row.id}`)} emptyMessage="No transactions match these filters." />
        <Pagination page={meta.page} totalPages={meta.totalPages} onChange={setPage} />
      </>}
    </div>
  );
}
