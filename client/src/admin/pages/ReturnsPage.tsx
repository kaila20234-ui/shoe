import { useMemo, useState } from 'react';
import type { ReturnStatus } from '../../shared/types';
import { api } from '../../shared/api/client';
import { useToast } from '../../shared/ui';
import { useAdminMockStore } from '../components/AdminMockStore';
import { EmptyState, Section } from '../components/ui';

const returnStatuses: ReturnStatus[] = ['requested', 'approved', 'rejected', 'refunded'];

export function ReturnsPage() {
  const { returns, setReturns, refreshAdminData } = useAdminMockStore();
  const toast = useToast();
  const [filter, setFilter] = useState('');
  const filtered = useMemo(() => returns.filter((item) => !filter || item.status === filter), [returns, filter]);

  async function updateReturn(id: string, status: ReturnStatus, adminNote?: string) {
    try {
      const { data } = await api.patch<import('../../shared/types').ReturnRequest>(`/admin/returns/${encodeURIComponent(id)}`, {
        status,
        ...(adminNote !== undefined ? { adminNote } : {}),
      });
      setReturns((current) => current.map((item) => item.id === id ? data : item));
      await refreshAdminData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update return request.');
    }
  }

  return (
    <Section title="Returns">
      <div className="admin-toolbar"><select aria-label="Filter returns by status" value={filter} onChange={(event) => setFilter(event.target.value)}>
        <option value="">All statuses</option>{returnStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
      </select></div>
      {filtered.length ? (
        <div className="admin-table-wrap"><table className="table">
          <thead><tr><th>Order</th><th>Reason</th><th>Items</th><th>Requested</th><th>Status</th><th>Admin note</th><th>Action</th></tr></thead>
          <tbody>{filtered.map((item) => (
            <ReturnRow key={item.id} id={item.id} orderNumber={item.orderNumber} reason={item.reason}
              items={item.items.map(({ sku, quantity }) => `${sku} × ${quantity}`).join(', ')}
              createdAt={item.createdAt} status={item.status} note={item.adminNote}
              onUpdate={(status, note) => updateReturn(item.id, status, note)} />
          ))}</tbody>
        </table></div>
      ) : <EmptyState title="No return requests" />}
    </Section>
  );
}

function ReturnRow({ id, orderNumber, reason, items, createdAt, status, note, onUpdate }: {
  id: string;
  orderNumber: string;
  reason: string;
  items: string;
  createdAt: string;
  status: ReturnStatus;
  note?: string;
  onUpdate: (status: ReturnStatus, note: string) => void | Promise<void>;
}) {
  const [nextStatus, setNextStatus] = useState<ReturnStatus>(status);
  const [adminNote, setAdminNote] = useState(note ?? '');
  return (
    <tr>
      <td>{orderNumber}</td><td>{reason}</td><td>{items}</td><td>{new Date(createdAt).toLocaleDateString()}</td><td>{status}</td>
      <td><input aria-label={`Admin note for ${id}`} value={adminNote} onChange={(event) => setAdminNote(event.target.value)} /></td>
      <td className="admin-actions">
        <select aria-label={`Return status for ${id}`} value={nextStatus} onChange={(event) => setNextStatus(event.target.value as ReturnStatus)}>
          {returnStatuses.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <button className="button" type="button" onClick={() => void onUpdate(nextStatus, adminNote)}>Save</button>
      </td>
    </tr>
  );
}
