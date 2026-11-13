import { useMemo, useState } from 'react';
import { api } from '../../shared/api/client';
import { useToast } from '../../shared/ui';
import { useAdminDataStore } from '../components/AdminDataStore';
import type { Product } from '../../shared/types';
import { EmptyState, Section } from '../components/ui';

export function InventoryPage() {
  const { products, setProducts, refreshAdminData } = useAdminDataStore();
  const toast = useToast();
  const [threshold, setThreshold] = useState('5');
  const lowStock = useMemo(() => products.flatMap((product) => product.variants
    .filter((variant) => variant.stock <= (Number(threshold) || 0))
    .map((variant) => ({ product, variant }))), [products, threshold]);

  async function updateStock(productId: string, sku: string, value: string) {
    const stock = Math.max(0, Math.floor(Number(value) || 0));
    try {
      const { data } = await api.patch<Product>(`/admin/products/${encodeURIComponent(productId)}/stock`, { sku, stock });
      setProducts((current) => current.map((product) => product.id === productId ? data : product));
      await refreshAdminData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update stock.');
    }
  }

  return (
    <Section title="Inventory">
      <div className="admin-toolbar admin-filter-bar">
        <label className="admin-filter-field admin-threshold-field"><span>Low-stock alert threshold</span><input aria-label="Low stock threshold" type="number" min="0" value={threshold} onChange={(event) => setThreshold(event.target.value)} /></label>
        <span className="admin-filter-hint">{lowStock.length} variant{lowStock.length === 1 ? '' : 's'} at or below this stock level.</span>
      </div>
      {lowStock.length ? (
        <div className="admin-table-wrap"><table className="table">
          <thead><tr><th>Product</th><th>SKU</th><th>Size</th><th>Color</th><th>Stock</th><th>Update</th></tr></thead>
          <tbody>{lowStock.map(({ product, variant }) => (
            <tr key={variant.sku}>
              <td>{product.name}</td><td>{variant.sku}</td><td>{variant.size}</td><td>{variant.color}</td>
              <td><span className="badge warning">{variant.stock}</span></td>
              <td><StockEditor sku={variant.sku} stock={variant.stock} onSave={(value) => updateStock(product.id, variant.sku, value)} /></td>
            </tr>
          ))}</tbody>
        </table></div>
      ) : <EmptyState title="No low-stock variants" description="Increase the threshold or check back later." />}
    </Section>
  );
}

function StockEditor({ sku, stock, onSave }: { sku: string; stock: number; onSave: (value: string) => void | Promise<void> }) {
  const [value, setValue] = useState(String(stock));
  return (
    <div className="admin-actions admin-stock-editor">
      <input aria-label={`Set stock for ${sku}`} type="number" min="0" step="1" value={value} onChange={(event) => setValue(event.target.value)} />
      <button className="button ghost" type="button" disabled={Number(value) === stock} onClick={() => void onSave(value)}>Save</button>
    </div>
  );
}
