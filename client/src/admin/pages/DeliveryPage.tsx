import { useState, type FormEvent } from 'react';
import type { DeliveryZone } from '../../shared/types';
import { api } from '../../shared/api/client';
import { useToast } from '../../shared/ui';
import { useAdminMockStore } from '../components/AdminMockStore';
import { formatPrice } from '../components/format';
import { EmptyState, Section } from '../components/ui';

export function DeliveryPage() {
  const { deliveryZones, setDeliveryZones, refreshAdminData } = useAdminMockStore();
  const toast = useToast();
  const [editing, setEditing] = useState<DeliveryZone | null>(null);
  const [name, setName] = useState('');
  const [states, setStates] = useState('');
  const [fee, setFee] = useState('');
  const [estimatedDays, setEstimatedDays] = useState('');
  const [error, setError] = useState('');

  async function saveZone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const zone: Omit<DeliveryZone, 'id'> = {
      name: name.trim(),
      states: states.split(',').map((state) => state.trim()).filter(Boolean),
      fee: Math.round(Number(fee) * 100),
      estimatedDays: estimatedDays.trim(),
      isActive: editing?.isActive ?? true,
    };
    if (!zone.name || !zone.states.length || !Number.isFinite(zone.fee) || zone.fee < 0 || !zone.estimatedDays) {
      setError('Enter a zone name, at least one state, a valid fee, and estimated delivery time.');
      return;
    }
    try {
      const { data } = editing
        ? await api.patch<DeliveryZone>(`/admin/delivery-zones/${encodeURIComponent(editing.id)}`, zone)
        : await api.post<DeliveryZone>('/admin/delivery-zones', zone);
      setDeliveryZones((current) => editing
        ? current.map((item) => item.id === editing.id ? data : item)
        : [data, ...current]);
      await refreshAdminData();
      resetForm();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save delivery zone.');
    }
  }

  function startEdit(zone: DeliveryZone) {
    setEditing(zone); setName(zone.name); setStates(zone.states.join(', '));
    setFee(String(zone.fee / 100)); setEstimatedDays(zone.estimatedDays); setError('');
  }

  function resetForm() {
    setEditing(null); setName(''); setStates(''); setFee(''); setEstimatedDays(''); setError('');
  }

  async function toggleZone(zone: DeliveryZone) {
    try {
      const { data } = await api.patch<DeliveryZone>(`/admin/delivery-zones/${encodeURIComponent(zone.id)}`, { isActive: !zone.isActive });
      setDeliveryZones((current) => current.map((item) => item.id === zone.id ? data : item));
      await refreshAdminData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update delivery zone.');
    }
  }

  async function deleteZone(zone: DeliveryZone) {
    try {
      await api.delete(`/admin/delivery-zones/${encodeURIComponent(zone.id)}`);
      setDeliveryZones((current) => current.filter((item) => item.id !== zone.id));
      await refreshAdminData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to delete delivery zone.');
    }
  }

  return (
    <Section title="Delivery zones">
      <details className="admin-disclosure">
        <summary>{editing ? 'Edit delivery zone' : 'Add delivery zone'}</summary>
        <form className="admin-form" onSubmit={saveZone}>
          <label>Zone name<input required value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label>States (comma separated)<input required placeholder="Lagos, Ogun" value={states} onChange={(event) => setStates(event.target.value)} /></label>
          <label>Delivery fee (₦)<input type="number" min="0" step="0.01" required value={fee} onChange={(event) => setFee(event.target.value)} /></label>
          <label>Estimated days<input required placeholder="2-3 days" value={estimatedDays} onChange={(event) => setEstimatedDays(event.target.value)} /></label>
          {error && <p className="admin-error" role="alert">{error}</p>}
          <div className="admin-actions"><button className="button" type="submit">{editing ? 'Save changes' : 'Add zone'}</button>{editing && <button className="button ghost" type="button" onClick={resetForm}>Cancel edit</button>}</div>
        </form>
      </details>
      {deliveryZones.length ? (
        <div className="admin-table-wrap"><table className="table">
          <thead><tr><th>Name</th><th>States</th><th>Fee</th><th>Estimated</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>{deliveryZones.map((zone) => (
            <tr key={zone.id}>
              <td>{zone.name}</td><td>{zone.states.join(', ')}</td><td>{formatPrice(zone.fee)}</td><td>{zone.estimatedDays}</td>
              <td><span className={`badge ${zone.isActive ? 'success' : 'default'}`}>{zone.isActive ? 'Active' : 'Inactive'}</span></td>
              <td className="admin-actions">
                <button className="button ghost" type="button" onClick={() => startEdit(zone)}>Edit</button>
                <button className="button ghost" type="button" onClick={() => void toggleZone(zone)}>{zone.isActive ? 'Deactivate' : 'Activate'}</button>
                <button className="button danger" type="button" onClick={() => void deleteZone(zone)}>Delete</button>
              </td>
            </tr>
          ))}</tbody>
        </table></div>
      ) : <EmptyState title="No delivery zones" />}
    </Section>
  );
}
