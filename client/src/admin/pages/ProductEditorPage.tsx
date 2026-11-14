import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Audience, Product, ShoeType } from '../../shared/types';
import { api } from '../../shared/api/client';
import { useToast } from '../../shared/ui';
import { useAdminDataStore } from '../components/AdminDataStore';
import { Section } from '../components/ui';

const audiences: Audience[] = ['men', 'women', 'kids'];
const shoeTypes: ShoeType[] = ['sneakers', 'formal', 'sandals', 'boots', 'sports'];

function isValidModelUrl(value: string) {
  if (/^\/uploads\/models\/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\.glb$/i.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && /\.(?:glb|gltf)$/i.test(url.pathname);
  } catch {
    return false;
  }
}

export function ProductEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { products, setProducts, isLoading, refreshAdminData } = useAdminDataStore();
  const toast = useToast();
  const existing = products.find((item) => item.id === id);
  const [name, setName] = useState(existing?.name ?? '');
  const [brand, setBrand] = useState(existing?.brand ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [modelUrl, setModelUrl] = useState(existing?.modelUrl ?? '');
  const [audience, setAudience] = useState<Audience>(existing?.audience ?? 'men');
  const [type, setType] = useState<ShoeType>(existing?.type ?? 'sneakers');
  const [price, setPrice] = useState(existing ? String(existing.price / 100) : '');
  const [salePrice, setSalePrice] = useState(existing?.salePrice ? String(existing.salePrice / 100) : '');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [modelFile, setModelFile] = useState<File | null>(null);
  const modelFileInputRef = useRef<HTMLInputElement>(null);
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
    setModelUrl(existing.modelUrl ?? '');
    setModelFile(null);
    if (modelFileInputRef.current) modelFileInputRef.current.value = '';
    setAudience(existing.audience);
    setType(existing.type);
    setPrice(String(existing.price / 100));
    setSalePrice(existing.salePrice ? String(existing.salePrice / 100) : '');
    setImageFile(null);
    setSku(existing.variants[0]?.sku ?? '');
    setSize(String(existing.variants[0]?.size ?? ''));
    setColor(existing.variants[0]?.color ?? '');
    setStock(String(existing.variants[0]?.stock ?? 0));
  }, [existing?.id]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedModelUrl = modelUrl.trim();
    if (!modelFile && normalizedModelUrl && !isValidModelUrl(normalizedModelUrl)) {
      setError('3D model URL must be an HTTPS link ending in .glb or .gltf.');
      return;
    }
    const priceKobo = Math.round(Number(price) * 100);
    const salePriceKobo = salePrice === '' ? undefined : Math.round(Number(salePrice) * 100);
    if (!name.trim() || !description.trim() || !brand.trim() || !sku.trim() || !color.trim() || (!existing?.images.length && !imageFile) || !Number.isInteger(priceKobo) || priceKobo <= 0) {
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
      let images = existing?.images ?? [];
      if (imageFile) {
        const formData = new FormData();
        formData.append('image', imageFile);
        const { data: uploaded } = await api.post<{ url: string }>('/admin/uploads/image', formData);
        images = [uploaded.url, ...images.slice(1)];
      }
      let savedModelUrl = normalizedModelUrl;
      if (modelFile) {
        const formData = new FormData();
        formData.append('model', modelFile);
        const { data: uploaded } = await api.post<{ url: string }>('/admin/uploads/model', formData);
        savedModelUrl = uploaded.url;
      }
      const input = {
        name: name.trim(),
        description: description.trim(),
        ...(savedModelUrl ? { modelUrl: savedModelUrl } : existing ? { modelUrl: null } : {}),
        brand: brand.trim(),
        audience,
        type,
        price: priceKobo,
        ...(salePriceKobo === undefined ? {} : { salePrice: salePriceKobo }),
        images,
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
        <div className="admin-form-intro">
          <span className="admin-form-step">PRODUCT CATALOGUE</span>
          <h2>{existing ? 'Keep your product details current' : 'Bring a new pair to your store'}</h2>
          <p>Add clear product details, pricing, imagery, and the first size variant.</p>
        </div>
        <fieldset className="admin-form-section">
          <legend><span>01</span> Product details</legend>
          <div className="admin-form-section__grid">
            <label>Product name<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Classic leather trainer" /></label>
            <label>Brand<input required value={brand} onChange={(event) => setBrand(event.target.value)} placeholder="e.g. Northline" /></label>
            <label className="is-wide">Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder="Describe the materials, fit, and standout details." /></label>
            <label className="is-wide">3D model URL <span className="admin-field-suffix">Optional · HTTPS .glb or .gltf</span><input type="text" inputMode="url" value={modelUrl} onChange={(event) => { setModelUrl(event.target.value); if (modelFile) { setModelFile(null); if (modelFileInputRef.current) modelFileInputRef.current.value = ''; } }} placeholder="https://example.com/shoe.glb" /></label>
            <label className="is-wide">Or upload a GLB file <span className="admin-field-suffix">Maximum 20 MB</span><input ref={modelFileInputRef} type="file" accept=".glb,model/gltf-binary,application/octet-stream" onChange={(event) => { const file = event.target.files?.[0] ?? null; setModelFile(file); if (file) setModelUrl(''); }} /></label>
            <label>Audience<select value={audience} onChange={(event) => setAudience(event.target.value as Audience)}>{audiences.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label>Shoe type<select value={type} onChange={(event) => setType(event.target.value as ShoeType)}>{shoeTypes.map((value) => <option key={value}>{value}</option>)}</select></label>
          </div>
        </fieldset>
        <fieldset className="admin-form-section">
          <legend><span>02</span> Pricing</legend>
          <div className="admin-form-section__grid">
            <label>Regular price <span className="admin-field-suffix">NGN</span><input type="number" min="1" step="0.01" required value={price} onChange={(event) => setPrice(event.target.value)} placeholder="0.00" /></label>
            <label>Sale price <span className="admin-field-suffix">Optional · NGN</span><input type="number" min="0.01" step="0.01" value={salePrice} onChange={(event) => setSalePrice(event.target.value)} placeholder="Leave blank if not on sale" /></label>
          </div>
        </fieldset>
        <fieldset className="admin-form-section">
          <legend><span>03</span> Product image</legend>
          <p className="admin-form-section__hint">Upload a clear, well-lit JPG, PNG, or WebP image to this server. Maximum size: 5 MB.</p>
          <div className="admin-form-section__grid">
            <label className="is-wide">Image file<input type="file" accept="image/jpeg,image/png,image/webp" required={!existing?.images.length} onChange={(event) => setImageFile(event.target.files?.[0] ?? null)} /></label>
          </div>
        </fieldset>
        <fieldset className="admin-form-section">
          <legend><span>04</span> First size variant</legend>
          <p className="admin-form-section__hint">You can add or adjust stock variants from Inventory after saving.</p>
          <div className="admin-form-section__grid">
            <label>SKU<input required value={sku} onChange={(event) => setSku(event.target.value)} placeholder="e.g. NL-TR-42-BLK" /></label>
            <label>EU size<input type="number" min="1" required value={size} onChange={(event) => setSize(event.target.value)} placeholder="42" /></label>
            <label>Color<input required value={color} onChange={(event) => setColor(event.target.value)} placeholder="Black" /></label>
            <label>Opening stock<input type="number" min="0" step="1" required value={stock} onChange={(event) => setStock(event.target.value)} placeholder="0" /></label>
          </div>
        </fieldset>
        {error && <p className="admin-error" role="alert">{error}</p>}
        <div className="admin-form-footer">
          <span>Review the details before publishing this product.</span>
          <div className="admin-actions">
            <Link className="button ghost" to="/admin/products">Cancel</Link>
            <button className="button" type="submit">{existing ? 'Save product changes' : 'Create product'}</button>
          </div>
        </div>
      </form>
    </Section>
  );
}
