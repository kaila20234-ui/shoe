import { useMemo, useState } from 'react';
import { api } from '../../shared/api/client';
import { useToast } from '../../shared/ui';
import { useAdminMockStore } from '../components/AdminMockStore';
import { formatPrice } from '../components/format';
import { EmptyState, Section } from '../components/ui';

export function CustomersPage() {
  const { customers, setCustomers, refreshAdminData } = useAdminMockStore();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => customers.filter((customer) => (
    `${customer.name} ${customer.email}`.toLowerCase().includes(query.toLowerCase())
  )), [customers, query]);

  async function toggleStatus(id: string) {
    const customer = customers.find((item) => item.id === id);
    if (!customer) return;
    const isActive = customer.status !== 'active';
    try {
      await api.patch(`/admin/customers/${encodeURIComponent(id)}/status`, { isActive });
      setCustomers((current) => current.map((item) => item.id === id ? { ...item, status: isActive ? 'active' : 'blocked' } : item));
      await refreshAdminData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update customer status.');
    }
  }

  return (
    <Section title="Customers">
      <div className="admin-toolbar"><input aria-label="Search customers" placeholder="Search name or email" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
      {filtered.length ? (
        <div className="admin-table-wrap"><table className="table">
          <thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Total spent</th><th>Action</th></tr></thead>
          <tbody>{filtered.map((customer) => (
            <tr key={customer.id}>
              <td>{customer.name}</td><td>{customer.email}</td>
              <td><span className={`badge ${customer.status === 'active' ? 'success' : 'danger'}`}>{customer.status}</span></td>
              <td>{formatPrice(customer.totalSpent)}</td>
              <td><button className={`button ${customer.status === 'active' ? 'danger' : 'ghost'}`} type="button" onClick={() => toggleStatus(customer.id)}>{customer.status === 'active' ? 'Block' : 'Unblock'}</button></td>
            </tr>
          ))}</tbody>
        </table></div>
      ) : <EmptyState title="No customers found" />}
    </Section>
  );
}
