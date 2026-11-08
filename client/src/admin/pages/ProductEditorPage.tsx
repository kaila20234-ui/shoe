import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Audience, Product, ShoeType } from '../../shared/types';
import { api } from '../../shared/api/client';
import { useToast } from '../../shared/ui';
import { useAdminMockStore } from '../components/AdminMockStore';
import { Section } from '../components/ui';

const audiences: Audience[] = ['men', 'women', 'kids'];
const shoeTypes: ShoeType[] = ['sneakers', 'formal', 'sandals', 'boots', 'sports'];

export function ProductEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { products, setProducts, isLoading, refreshAdminData } = useAdminMockStore();
  const toast = useToast();
  const existing = products.find((item) => item.id === id);
  const [name, setName] = useState(existing?.name ?? '');
  const [brand, setBrand] = useState(existing?.brand ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [audience, setAudience] = useState<Audience>(existing?.audience ?? 'men');
  const [type, setType] = useState<ShoeType>(existing?.type ?? 'sneakers');
  const [price, setPrice] = useState(existing ? String(existing.price / 100) : '');
  const [salePrice, setSalePrice] = useState(existing?.salePrice ? String(existing.salePrice / 100) : '');
  const [image, setImage] = useState(existing?.images[0] ?? '');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [sku, setSku] = useState(existing?.variants[0]?.sku ?? '');
  const [size, setSize] = useState(existing ? String(existing.variants[0]?.size ?? '') : '');
  const [color, setColor] = useState(existing?.variants[0]?.color ?? '');
  const [stock, setStock] = useState(existing ? String(existing.variants[0]?.stock ?? 0) : '0');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!existing) return;
    setName(existing.name);
    setBrand(existing.brand);
    setDescription(existing.description);
    setAudience(existing.audience);
    setType(existing.type);
    setPrice(String(existing.price / 100));
    setSalePrice(existing.salePrice ? String(existing.salePrice / 100) : '');
    setImage(existing.images[0] ?? '');
    setImageFile(null);
    setSku(existing.variants[0]?.sku ?? '');
    setSize(String(existing.variants[0]?.size ?? ''));
    setColor(existing.variants[0]?.color ?? '');
    setStock(String(existing.variants[0]?.stock ?? 0));
  }, [existing?.id]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const priceKobo = Math.round(Number(price) * 100);
    const salePriceKobo = salePrice === '' ? undefined : Math.round(Number(salePrice) * 100);
    if (!name.trim() || !description.trim() || !brand.trim() || !sku.trim() || !color.trim() || (!image.trim() && !imageFile) || !Number.isInteger(priceKobo) || priceKobo <= 0) {
      setError('Complete all required fields and enter a valid price.');
      return;
    }
    if (salePriceKobo !== undefined && (salePriceKobo <= 0 || salePriceKobo >= priceKobo)) {
      setError('Sale price must be greater than zero and lower than the regular price.');
      return;
    }
    if (!Number.isInteger(Number(size)) || Number(size) <= 0 || !Number.isInteger(Number(stock)) || Number(stock) < 0) {
      setError('Enter a valid EU size and a non-negative whole-number stock count.');
      return;
    }
    if (products.some((product) => product.variants.some((variant, index) => (
      variant.sku === sku.trim() && (product.id !== existing?.id || index !== 0)
    )))) {
      setError('SKU must be unique across products.');
      return;
    }
    const firstVariant = {
      sku: sku.trim(),
      size: Number(size),
      color: color.trim(),
      stock: Number(stock),
    };
    try {
      let imageUrl = image.trim();
      if (imageFile) {
        const formData = new FormData();
        formData.append('image', imageFile);
        const { data: uploaded } = await api.post<{ url: string }>('/admin/uploads/image', formData);
        imageUrl = uploaded.url;
      }
      const input = {
        name: name.trim(),
        description: description.trim(),
        brand: brand.trim(),
        audience,
        type,
        price: priceKobo,
        ...(salePriceKobo === undefined ? {} : { salePrice: salePriceKobo }),
        images: [imageUrl],
        variants: existing
          ? existing.variants.length
            ? existing.variants.map((variant, index) => index === 0 ? firstVariant : variant)
            : [firstVariant]
          : [firstVariant],
        isActive: existing?.isActive ?? true,
      };
      const { data: product } = existing
        ? await api.patch<Product>(`/admin/products/${encodeURIComponent(existing.id)}`, input)
        : await api.post<Product>('/admin/products', input);
      setProducts((current) => existing
        ? current.map((item) => item.id === existing.id ? product : item)
        : [product, ...current]);
      await refreshAdminData();
      navigate('/admin/products');
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Unable to save product.';
      setError(message);
      toast.error(message);
    }
  }

  if (id && isLoading) return <Section title="Loading product"><p role="status">Loading product details…</p></Section>;
  if (id && !existing) {
    return <Section title="Product not found"><p>The requested product is unavailable.</p><Link to="/admin/products">Back to products</Link></Section>;
  }

  return (
    <Section title={existing ? 'Edit product' : 'Add product'}>
      <form className="admin-form" onSubmit={handleSubmit}>
        <label>Product name<input required value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label>Brand<input required value={brand} onChange={(event) => setBrand(event.target.value)} /></label>
        <label>Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} /></label>
        <label>Audience<select value={audience} onChange={(event) => setAudience(event.target.value as Audience)}>{audiences.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Shoe type<select value={type} onChange={(event) => setType(event.target.value as ShoeType)}>{shoeTypes.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Price (₦)<input type="number" min="1" step="0.01" required value={price} onChange={(event) => setPrice(event.target.value)} /></label>
        <label>Sale price (₦)<input type="number" min="0.01" step="0.01" value={salePrice} onChange={(event) => setSalePrice(event.target.value)} /></label>
        <label>Image URL<input type="url" value={image} onChange={(event) => setImage(event.target.value)} /></label>
        <label>Or upload image<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setImageFile(event.target.files?.[0] ?? null)} /></label>
        <label>SKU<input required value={sku} onChange={(event) => setSku(event.target.value)} /></label>
        <label>EU size<input type="number" min="1" required value={size} onChange={(event) => setSize(event.target.value)} /></label>
        <label>Color<input required value={color} onChange={(event) => setColor(event.target.value)} /></label>
        <label>Stock<input type="number" min="0" step="1" required value={stock} onChange={(event) => setStock(event.target.value)} /></label>
        {error && <p className="admin-error" role="alert">{error}</p>}
        <div className="admin-actions">
          <button className="button" type="submit">Save product</button>
          <Link className="button ghost" to="/admin/products">Cancel</Link>
        </div>
      </form>
    </Section>
  );
}
