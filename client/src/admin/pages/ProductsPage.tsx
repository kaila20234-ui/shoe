import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../shared/api/client';
import { useToast } from '../../shared/ui';
import { useAdminMockStore } from '../components/AdminMockStore';
import { formatPrice } from '../components/format';
import { EmptyState, Section } from '../components/ui';

export function ProductsPage() {
  const { products, setProducts, refreshAdminData } = useAdminMockStore();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const filteredProducts = useMemo(() => products.filter((product) => {
    const matchesQuery = `${product.name} ${product.brand}`.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = status === 'all' || String(product.isActive) === status;
    return matchesQuery && matchesStatus;
  }), [products, query, status]);

  async function toggleProduct(id: string) {
    const product = products.find((item) => item.id === id);
    if (!product) return;
    try {
      if (product.isActive) {
        await api.delete(`/admin/products/${encodeURIComponent(id)}`);
        setProducts((current) => current.map((item) => item.id === id ? { ...item, isActive: false } : item));
      } else {
        const { data } = await api.patch<typeof product>(`/admin/products/${encodeURIComponent(id)}`, { isActive: true });
        setProducts((current) => current.map((item) => item.id === id ? data : item));
      }
      await refreshAdminData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update product status.');
    }
  }

  return (
    <Section title="Products">
      <div className="admin-toolbar">
        <input aria-label="Search products" placeholder="Search name or brand" value={query} onChange={(event) => setQuery(event.target.value)} />
        <select aria-label="Filter products by status" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">All statuses</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        <Link className="button" to="/admin/products/new">Add product</Link>
      </div>
      {filteredProducts.length ? (
        <div className="admin-table-wrap">
          <table className="table">
            <thead><tr><th>Product</th><th>Brand</th><th>Price</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{filteredProducts.map((product) => (
              <tr key={product.id}>
                <td><Link to={`/admin/products/${product.id}`}>{product.name}</Link></td>
                <td>{product.brand}</td>
                <td>{formatPrice(product.salePrice ?? product.price)}</td>
                <td>{product.variants.reduce((total, variant) => total + variant.stock, 0)}</td>
                <td><span className={`badge ${product.isActive ? 'success' : 'default'}`}>{product.isActive ? 'Active' : 'Inactive'}</span></td>
                <td><button className="button ghost" type="button" onClick={() => toggleProduct(product.id)}>{product.isActive ? 'Deactivate' : 'Activate'}</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : <EmptyState title="No products found" description="Try another search or add a product." />}
    </Section>
  );
}
