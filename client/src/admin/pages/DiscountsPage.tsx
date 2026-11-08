import { useState, type FormEvent } from 'react';
import type { Discount, DiscountType } from '../../shared/types';
import { api } from '../../shared/api/client';
import { useToast } from '../../shared/ui';
import { useAdminMockStore } from '../components/AdminMockStore';
import { formatPrice } from '../components/format';
import { EmptyState, Section } from '../components/ui';

export function DiscountsPage() {
  const { discounts, setDiscounts, refreshAdminData } = useAdminMockStore();
  const toast = useToast();
  const [editing, setEditing] = useState<Discount | null>(null);
  const [code, setCode] = useState('');
  const [type, setType] = useState<DiscountType>('percentage');
  const [value, setValue] = useState('');
  const [minSubtotal, setMinSubtotal] = useState('0');
  const [maxUses, setMaxUses] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [error, setError] = useState('');

  function startEdit(discount: Discount) {
    setEditing(discount);
    setCode(discount.code);
    setType(discount.type);
    setValue(String(discount.type === 'fixed' ? discount.value / 100 : discount.value));
    setMinSubtotal(String(discount.minSubtotal / 100));
    setMaxUses(discount.maxUses === undefined ? '' : String(discount.maxUses));
    setExpiresAt(discount.expiresAt?.slice(0, 10) ?? '');
    setError('');
  }

  function resetForm() {
    setEditing(null); setCode(''); setType('percentage'); setValue(''); setMinSubtotal('0'); setMaxUses(''); setExpiresAt(''); setError('');
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numericValue = Number(value);
    const valueInApi = type === 'fixed' ? Math.round(numericValue * 100) : Math.round(numericValue);
    if (!/^[A-Z0-9_-]+$/.test(code.trim().toUpperCase())) {
      setError('Use only letters, numbers, underscores, and hyphens in the code.');
      return;
    }
    if (!Number.isFinite(numericValue) || numericValue <= 0 || (type === 'percentage' && numericValue > 100)) {
      setError(type === 'percentage' ? 'Percentage must be from 1 to 100.' : 'Enter a positive discount amount.');
      return;
    }
    if (type === 'percentage' && !Number.isInteger(numericValue)) {
      setError('Percentage discounts must be a whole number.');
      return;
    }
    if (maxUses !== '' && (!Number.isInteger(Number(maxUses)) || Number(maxUses) < 1)) {
      setError('Maximum uses must be a positive whole number.');
      return;
    }
    if (minSubtotal !== '' && (!Number.isFinite(Number(minSubtotal)) || Number(minSubtotal) < 0)) {
      setError('Minimum subtotal must be zero or a positive amount.');
      return;
    }
    const duplicate = discounts.some((item) => item.code === code.trim().toUpperCase() && item.id !== editing?.id);
    if (duplicate) { setError('A discount with this code already exists.'); return; }
    const input = {
      code: code.trim().toUpperCase(),
      type,
      value: valueInApi,
      minSubtotal: Math.max(0, Math.round((Number(minSubtotal) || 0) * 100)),
      ...(maxUses === '' ? {} : { maxUses: Math.max(1, Math.floor(Number(maxUses))) }),
      ...(expiresAt ? { expiresAt: new Date(`${expiresAt}T23:59:59`).toISOString() } : {}),
      isActive: editing?.isActive ?? true,
    };
    try {
      const { data } = editing
        ? await api.patch<Discount>(`/admin/discounts/${encodeURIComponent(editing.id)}`, input)
        : await api.post<Discount>('/admin/discounts', input);
      setDiscounts((current) => editing
        ? current.map((item) => item.id === editing.id ? data : item)
        : [data, ...current]);
      await refreshAdminData();
      resetForm();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save discount.');
    }
  }

  async function remove(discount: Discount) {
    try {
      await api.delete(`/admin/discounts/${encodeURIComponent(discount.id)}`);
      setDiscounts((current) => current.filter((item) => item.id !== discount.id));
      await refreshAdminData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to delete discount.');
    }
  }

  async function toggleActive(discount: Discount) {
    try {
      const { data } = await api.patch<Discount>(`/admin/discounts/${encodeURIComponent(discount.id)}`, { isActive: !discount.isActive });
      setDiscounts((current) => current.map((item) => item.id === discount.id ? data : item));
      await refreshAdminData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update discount status.');
    }
  }

  return (
    <Section title="Discounts">
      <details className="admin-disclosure" open>
        <summary>{editing ? 'Edit discount' : 'Create discount'}</summary>
        <form className="admin-form" onSubmit={save}>
          <label>Code<input required value={code} onChange={(event) => setCode(event.target.value)} /></label>
          <label>Type<select value={type} onChange={(event) => setType(event.target.value as DiscountType)}><option value="percentage">Percentage</option><option value="fixed">Fixed amount</option></select></label>
          <label>Value{type === 'fixed' ? ' (₦)' : ' (%)'}<input type="number" min="0.01" step="0.01" required value={value} onChange={(event) => setValue(event.target.value)} /></label>
          <label>Minimum subtotal (₦)<input type="number" min="0" step="0.01" value={minSubtotal} onChange={(event) => setMinSubtotal(event.target.value)} /></label>
          <label>Max uses<input type="number" min="1" step="1" value={maxUses} onChange={(event) => setMaxUses(event.target.value)} /></label>
          <label>Expires on<input type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></label>
          {error && <p className="admin-error" role="alert">{error}</p>}
          <div className="admin-actions"><button className="button" type="submit">{editing ? 'Save changes' : 'Create discount'}</button>{editing && <button className="button ghost" type="button" onClick={resetForm}>Cancel edit</button>}</div>
        </form>
      </details>
      {discounts.length ? (
        <div className="admin-table-wrap"><table className="table">
          <thead><tr><th>Code</th><th>Type</th><th>Value</th><th>Minimum</th><th>Uses</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>{discounts.map((discount) => (
            <tr key={discount.id}>
              <td>{discount.code}</td><td>{discount.type}</td>
              <td>{discount.type === 'percentage' ? `${discount.value}%` : formatPrice(discount.value)}</td>
              <td>{formatPrice(discount.minSubtotal)}</td><td>{discount.usedCount}{discount.maxUses ? ` / ${discount.maxUses}` : ''}</td>
              <td><span className={`badge ${discount.isActive ? 'success' : 'default'}`}>{discount.isActive ? 'Active' : 'Inactive'}</span></td>
              <td className="admin-actions">
                <button className="button ghost" type="button" onClick={() => startEdit(discount)}>Edit</button>
                <button className="button ghost" type="button" onClick={() => {
                  void toggleActive(discount);
                }}>{discount.isActive ? 'Deactivate' : 'Activate'}</button>
                <button className="button danger" type="button" onClick={() => remove(discount)}>Delete</button>
              </td>
            </tr>
          ))}</tbody>
        </table></div>
      ) : <EmptyState title="No discounts" description="Create a discount code to get started." />}
    </Section>
  );
}
