import { Component, lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../shared/auth/AuthContext';
import { ApiClientError } from '../shared/api/client';
import { formatDate, formatDateTime, formatNaira } from '../shared/lib/format';
import { resolveAssetUrl } from '../shared/lib/assetUrl';
import { Button, EmptyState, Input, Modal, Select, Spinner, StatusBadge } from '../shared/ui';
import { addGuestCartItem, cartQueryKey, clearGuestCart, loadCart, readGuestCartEntries, setGuestCartItem } from './guestCart';
import type {
  Address,
  Cart,
  Product,
  Review,
  ShippingAddress,
} from '../shared/types';
import { customerApi, type ProductQuery } from './api';

const LazyProductViewer3D = lazy(() => import('./ProductViewer3D'));

function isProductViewerAvailable() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData) return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl') || canvas.getContext('webgl2'));
  } catch {
    return false;
  }
}

class ProductViewerErrorBoundary extends Component<{
  children: ReactNode;
  onError: () => void;
}, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

function PageError({ message }: { message: string }) {
  return <p role="alert" className="storefront-error">{message}</p>;
}

function Loading() {
  return <div className="flex justify-center py-16"><Spinner /></div>;
}

function PageTitle({ children }: { children: string }) {
  return <h1 className="mb-6 text-3xl font-bold tracking-tight">{children}</h1>;
}

function StoreEmpty({ title, description }: { title: string; description: string }) {
  return <div className="storefront-empty"><EmptyState title={title} /><p>{description}</p></div>;
}

function ProfileBackLink() {
  return <Link className="customer-back-link" to="/account/profile"><span aria-hidden="true">←</span> Back to profile</Link>;
}

function ProductCard({ product, onRemove }: { product: Product; onRemove?: () => void }) {
  const available = product.variants.some((variant) => variant.stock > 0);
  const onSale = product.salePrice !== undefined;
  return (
    <article className="shoe-card">
      <Link to={`/product/${product.slug}`} className="shoe-card__link">
        <div className="shoe-card__image">
          <img src={resolveAssetUrl(product.images[0])} alt={product.name} />
          {onSale && <span className="shoe-card__sale">Special price</span>}
          {!available && <span className="shoe-card__stock">Sold out</span>}
        </div>
        <div className="shoe-card__body">
          <p className="shoe-card__brand">{product.brand}</p>
          <h2 className="mt-1 font-semibold">{product.name}</h2>
          <div className="shoe-card__price">
            <strong>{formatNaira(product.salePrice ?? product.price)}</strong>
            {onSale && <del>{formatNaira(product.price)}</del>}
          </div>
          <p className="shoe-card__rating">★ {product.ratingAverage.toFixed(1)} <span>({product.ratingCount} reviews)</span></p>
        </div>
      </Link>
      {onRemove && <div className="shoe-card__remove"><Button onClick={onRemove}>Remove from wishlist</Button></div>}
    </article>
  );
}

function ProductGrid({ products }: { products: Product[] }) {
  if (!products.length) return <StoreEmpty title="No shoes found" description="Try changing your search or filters." />;
  return <div className="shoe-grid">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div>;
}

export function HomePage() {
  const arrivals = useQuery({ queryKey: ['products', 'home', 'newest'], queryFn: () => customerApi.products({ sort: 'newest', limit: 8 }) });
  const bestRated = useQuery({ queryKey: ['products', 'home', 'rating'], queryFn: () => customerApi.products({ sort: 'rating', limit: 4 }) });
  if (arrivals.isLoading || bestRated.isLoading) return <Loading />;
  if (arrivals.isError || bestRated.isError) return <PageError message="We couldn't load the storefront. Please try again." />;
  return (
    <div className="storefront-page storefront-home">
      <section className="home-hero">
        <div className="home-hero__copy">
          <span className="home-hero__eyebrow">Considered footwear · Made for every day</span>
          <h1>Good shoes take you places.</h1>
          <p>Find your new everyday pair in a collection chosen for comfort, craft, and the way you like to move.</p>
          <div className="home-hero__actions">
            <Link to="/shop">Explore the collection <span aria-hidden="true">→</span></Link>
            <span className="home-hero__note">Thoughtfully selected. Always in step.</span>
          </div>
        </div>
        <div className="home-hero__image" aria-hidden="true">
          <img src="https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1200&auto=format&fit=crop&q=85" alt="" />
          <div className="home-hero__stamp"><strong>Walk well.</strong><span>Since day one</span></div>
        </div>
      </section>
      <section className="store-section">
        <div className="store-section__heading"><div><span className="section-eyebrow">A good place to start</span><h2>Find your kind of fit</h2></div><Link to="/shop">Shop all</Link></div>
        <div className="category-grid">
          {([
            { audience: 'men', label: 'For him', image: 'https://images.unsplash.com/photo-1495555961986-6d4c1ecb7be3?w=900&auto=format&fit=crop&q=85' },
            { audience: 'women', label: 'For her', image: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd?w=900&auto=format&fit=crop&q=85' },
            { audience: 'kids', label: 'For little feet', image: 'https://images.unsplash.com/photo-1519861155730-0b5fbf0dd889?w=900&auto=format&fit=crop&q=85' },
          ] as const).map(({ audience, label, image }) => (
            <Link key={audience} to={`/shop?audience=${audience}`} className="category-tile">
              <img src={image} alt="" loading="lazy" />
              <div className="category-tile__copy"><span>Explore the edit</span><h3>{label} <span aria-hidden="true">↗</span></h3></div>
            </Link>
          ))}
        </div>
      </section>
      <section className="store-section"><div className="store-section__heading"><div><span className="section-eyebrow">Just landed</span><h2>New to the store</h2></div><Link to="/shop?sort=newest">See new arrivals</Link></div><ProductGrid products={arrivals.data?.data ?? []} /></section>
      <section className="store-section"><div className="store-section__heading"><div><span className="section-eyebrow">Loved by our customers</span><h2>Pairs worth sharing</h2></div><Link to="/shop?sort=rating">See best rated</Link></div><ProductGrid products={bestRated.data?.data ?? []} /></section>
      <section className="store-story"><span className="section-eyebrow">The SHOES edit</span><h2>Comfort is a good look on you.</h2><p>From the first step to the last stop of the day, we believe the right pair should feel as good as it looks.</p><Link to="/shop">Find your next pair <span aria-hidden="true">→</span></Link></section>
    </div>
  );
}

function queryFromSearch(search: URLSearchParams): ProductQuery {
  const numberParam = (key: string) => {
    const value = search.get(key);
    return value !== null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : undefined;
  };
  const sort = search.get('sort');
  return {
    q: search.get('q') || undefined,
    audience: search.get('audience') || undefined,
    type: search.get('type') || undefined,
    brand: search.get('brand') || undefined,
    size: numberParam('size'),
    color: search.get('color') || undefined,
    minPrice: numberParam('minPrice'),
    maxPrice: numberParam('maxPrice'),
    sort: sort === 'price_asc' || sort === 'price_desc' || sort === 'rating' ? sort : 'newest',
    page: numberParam('page') ?? 1,
    limit: 12,
  };
}

export function ShopPage() {
  const [search, setSearch] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const query = useMemo(() => queryFromSearch(search), [search]);
  const products = useQuery({ queryKey: ['products', query], queryFn: () => customerApi.products(query) });
  const filters = useQuery({ queryKey: ['product-filters'], queryFn: customerApi.productFilters });
  function update(key: string, value: string) {
    const next = new URLSearchParams(search);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearch(next);
  }
  const meta = filters.data;
  const totalPages = Math.max(1, products.data?.meta?.totalPages ?? 1);
  return (
    <div className="storefront-page shop-page">
      <header className="shop-heading"><div><span className="section-eyebrow">The full collection</span><PageTitle>Find your next pair</PageTitle><p>Thoughtful everyday shoes for all ages and all kinds of plans.</p></div></header>
      <div className="shop-search">
        <Input aria-label="Search shoes" placeholder="Search shoes or brands" value={query.q ?? ''} onChange={(event) => update('q', event.target.value)} />
        <Button type="button" className="filter-toggle" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((open) => !open)}>{filtersOpen ? 'Close filters' : 'Filters'}</Button>
      </div>
      <div className="shop-layout grid">
        <aside className={`shop-filters ${filtersOpen ? 'is-open' : 'is-closed'}`}>
          <h2>Refine your fit</h2>
          <label>Shop for<Select aria-label="Audience" value={query.audience ?? ''} onChange={(event) => update('audience', event.target.value)}><option value="">Everyone</option>{(meta?.audiences ?? ['men', 'women', 'kids']).map((item) => <option key={item} value={item}>{item}</option>)}</Select></label>
          <label>Style<Select aria-label="Shoe type" value={query.type ?? ''} onChange={(event) => update('type', event.target.value)}><option value="">All styles</option>{(meta?.types ?? []).map((item) => <option key={item} value={item}>{item}</option>)}</Select></label>
          <label>Brand<Select aria-label="Brand" value={query.brand ?? ''} onChange={(event) => update('brand', event.target.value)}><option value="">All brands</option>{(meta?.brands ?? []).map((item) => <option key={item} value={item}>{item}</option>)}</Select></label>
          <label>Size<Select aria-label="Size" value={query.size?.toString() ?? ''} onChange={(event) => update('size', event.target.value)}><option value="">All sizes</option>{(meta?.sizes ?? []).map((size) => <option key={size} value={size}>{size}</option>)}</Select></label>
          <label>Color<Select aria-label="Color" value={query.color ?? ''} onChange={(event) => update('color', event.target.value)}><option value="">All colors</option>{(meta?.colors ?? []).map((color) => <option key={color} value={color}>{color}</option>)}</Select></label>
          <label className="block text-sm">Minimum price (₦)<Input type="number" min={meta?.priceRange?.min ? meta.priceRange.min / 100 : 0} max={meta?.priceRange?.max ? meta.priceRange.max / 100 : undefined} step="0.01" value={query.minPrice === undefined ? '' : query.minPrice / 100} onChange={(event) => update('minPrice', event.target.value ? String(Math.round(Number(event.target.value) * 100)) : '')} /></label>
          <label className="block text-sm">Maximum price (₦)<Input type="number" min={meta?.priceRange?.min ? meta.priceRange.min / 100 : 0} max={meta?.priceRange?.max ? meta.priceRange.max / 100 : undefined} step="0.01" value={query.maxPrice === undefined ? '' : query.maxPrice / 100} onChange={(event) => update('maxPrice', event.target.value ? String(Math.round(Number(event.target.value) * 100)) : '')} /></label>
          <Button type="button" onClick={() => { setSearch(new URLSearchParams()); setFiltersOpen(false); }}>Clear all filters</Button>
        </aside>
        <section>
          <div className="shop-results__bar mb-4 flex flex-wrap items-center justify-between gap-3"><p className="shop-count">{products.data?.meta?.total ?? 0} pairs to explore</p><Select aria-label="Sort products" value={query.sort} onChange={(event) => update('sort', event.target.value)}><option value="newest">Sort: newest</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option><option value="rating">Sort: best rated</option></Select></div>
          {filters.isError && <PageError message="Some filters are unavailable right now." />}
          {products.isLoading ? <Loading /> : products.isError ? <PageError message="Couldn't load products. Please try again." /> : <ProductGrid products={products.data?.data ?? []} />}
          <div className="mt-6 flex items-center justify-center gap-4">
            <Button type="button" disabled={(query.page ?? 1) <= 1} onClick={() => update('page', String((query.page ?? 1) - 1))}>Previous</Button>
            <span>Page {query.page ?? 1} of {totalPages}</span>
            <Button type="button" disabled={(query.page ?? 1) >= totalPages} onClick={() => update('page', String((query.page ?? 1) + 1))}>Next</Button>
          </div>
        </section>
      </div>
    </div>
  );
}

export function ProductPage() {
  const { slug = '' } = useParams();
  const { user } = useAuth('customer');
  const navigate = useNavigate();
  const location = useLocation();
  const client = useQueryClient();
  const [sku, setSku] = useState('');
  const [imageIndex, setImageIndex] = useState(0);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [failedImageUrl, setFailedImageUrl] = useState('');
  const [viewerMode, setViewerMode] = useState<'photos' | '3d'>('photos');
  const [viewerNotice, setViewerNotice] = useState('');
  const [reviewPage, setReviewPage] = useState(1);
  const [rating, setRating] = useState('5');
  const [comment, setComment] = useState('');
  const product = useQuery({ queryKey: ['product', slug], queryFn: () => customerApi.product(slug) });
  const wishlist = useQuery({ queryKey: ['wishlist'], queryFn: customerApi.wishlist, enabled: user?.role === 'customer' });
  const reviews = useQuery({ queryKey: ['reviews', product.data?.id, reviewPage], queryFn: () => customerApi.reviews(product.data!.id, reviewPage), enabled: !!product.data });
  useEffect(() => {
    setViewerMode('photos');
    setViewerNotice('');
  }, [slug]);
  const selected = product.data?.variants.find((variant) => variant.sku === sku) ?? product.data?.variants.find((variant) => variant.stock > 0);
  const selectedVariantSku = selected?.sku ?? '';
  const cartKey = cartQueryKey(user?.role === 'customer' ? user.id : undefined);
  const cartMutation = useMutation({
    mutationFn: async () => {
      if (user?.role !== 'customer') return addGuestCartItem(product.data!.id, selectedVariantSku);
      const currentCart = client.getQueryData<Cart>(cartKey) ?? await customerApi.cart();
      const current = currentCart.items.find((item) => item.sku === selectedVariantSku)?.quantity ?? 0;
      return customerApi.setCartItem(product.data!.id, selectedVariantSku, current + 1);
    },
    onSuccess: (cart) => client.setQueryData(cartKey, cart),
  });
  const wishlistMutation = useMutation({
    mutationFn: () => customerApi.toggleWishlist(product.data!.id, wishlist.data?.includes(product.data!.id) ?? false),
    onSuccess: (ids) => client.setQueryData(['wishlist'], ids),
  });
  const reviewMutation = useMutation({
    mutationFn: () => customerApi.createReview(product.data!.id, { rating: Number(rating), comment }),
    onSuccess: () => { setComment(''); void client.invalidateQueries({ queryKey: ['reviews', product.data?.id] }); },
  });
  const backToShop = <Link className="product-detail__back" to="/shop">← Back to shop</Link>;
  function chooseViewer(mode: 'photos' | '3d') {
    if (mode === '3d' && !isProductViewerAvailable()) {
      setViewerMode('photos');
      setViewerNotice('3D preview is unavailable with this device or display preference. Showing photos instead.');
      return;
    }
    setViewerMode(mode);
    setViewerNotice('');
  }
  function fallBackToPhotos() {
    setViewerMode('photos');
    setViewerNotice('The 3D model could not be displayed. Showing photos instead.');
  }
  if (product.isLoading) return <div className="storefront-page">{backToShop}<Loading /></div>;
  if (product.isError || !product.data) return <div className="storefront-page">{backToShop}<PageError message="This product could not be found." /></div>;
  const saved = wishlist.data?.includes(product.data.id) ?? false;
  const selectedImageUrl = resolveAssetUrl(product.data.images[imageIndex] ?? product.data.images[0]);
  const selectedImageUnavailable = failedImageUrl === selectedImageUrl;
  return (
    <div className="storefront-page product-detail grid">
      {backToShop}
      <div className="product-detail__gallery">
        {product.data.modelUrl && <div className="product-detail__view-toggle" role="group" aria-label="Product view">
          <button type="button" aria-pressed={viewerMode === 'photos'} onClick={() => chooseViewer('photos')}>Photos</button>
          <button type="button" aria-pressed={viewerMode === '3d'} onClick={() => chooseViewer('3d')}>3D</button>
        </div>}
        {product.data.modelUrl && viewerMode === '3d' ? (
          <ProductViewerErrorBoundary onError={fallBackToPhotos}>
            <Suspense fallback={<div className="product-detail__viewer-loading" role="status">Loading 3D model…</div>}>
              <LazyProductViewer3D
                modelUrl={product.data.modelUrl}
                productName={product.data.name}
                onError={fallBackToPhotos}
              />
            </Suspense>
          </ProductViewerErrorBoundary>
        ) : <div className="product-detail__main-image">{selectedImageUnavailable
          ? <p className="product-detail__image-unavailable" role="status">Product image unavailable</p>
          : <button type="button" className="product-detail__preview-button" aria-label={`Preview ${product.data.name} image`} onClick={() => setImagePreviewOpen(true)}>
            <img src={selectedImageUrl} alt={product.data.name} onError={() => setFailedImageUrl(selectedImageUrl)} />
          </button>}
        </div>}
        {viewerNotice && <p className="product-detail__viewer-notice" role="status">{viewerNotice}</p>}
        <div className="product-detail__thumbs">{product.data.images.map((image, index) => <button key={image} type="button" aria-current={imageIndex === index} aria-label={`View image ${index + 1}`} onClick={() => { setImageIndex(index); chooseViewer('photos'); }}><img src={resolveAssetUrl(image)} alt="" /></button>)}</div>
      </div>
      <section className="product-detail__info">
        <p className="product-detail__brand">{product.data.brand} · {product.data.audience}</p>
        <h1 className="mt-2 text-3xl font-bold">{product.data.name}</h1>
        <p className="product-detail__rating">★ {product.data.ratingAverage.toFixed(1)} · {product.data.ratingCount} customer reviews</p>
        <p className="product-detail__price">{formatNaira(product.data.salePrice ?? product.data.price)} {product.data.salePrice !== undefined && <del>{formatNaira(product.data.price)}</del>}</p>
        <p className="product-detail__description">{product.data.description}</p>
        <label className="mt-6 block font-medium">Size and color
          <Select value={sku || selected?.sku || ''} onChange={(event) => setSku(event.target.value)} className="mt-2">
            {product.data.variants.map((variant) => <option key={variant.sku} value={variant.sku} disabled={variant.stock <= 0}>{variant.size} · {variant.color}{variant.stock <= 0 ? ' · Out of stock' : ` · ${variant.stock} available`}</option>)}
          </Select>
        </label>
        <div className="product-detail__actions">
          <Button disabled={!selected || selected.stock <= 0 || cartMutation.isPending} onClick={() => cartMutation.mutate()}>{cartMutation.isPending ? 'Adding…' : 'Add to cart'}</Button>
          <Button disabled={wishlistMutation.isPending} onClick={() => user?.role === 'customer' ? wishlistMutation.mutate() : navigate('/login', { state: { from: `${location.pathname}${location.search}` } })}>{saved ? 'Remove from wishlist' : '♡ Save to wishlist'}</Button>
        </div>
        {cartMutation.isError && <PageError message="Could not add this size to your cart. Check available stock and try again." />}
        {wishlistMutation.isError && <PageError message="Could not update your wishlist." />}
        <section className="product-reviews">
          <span className="section-eyebrow">From the community</span><h2>Customer reviews</h2>
          {user?.role === 'customer' && <form className="mt-4 space-y-3" onSubmit={(event) => { event.preventDefault(); reviewMutation.mutate(); }}>
            <Select aria-label="Rating" value={rating} onChange={(event) => setRating(event.target.value)}>{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} stars</option>)}</Select>
            <textarea required minLength={5} aria-label="Review" placeholder="Share your experience" rows={4} value={comment} onChange={(event) => setComment(event.target.value)} />
            <Button type="submit" disabled={reviewMutation.isPending}>Submit review</Button>
            {reviewMutation.isSuccess && <p role="status">Thanks! Your review is awaiting approval.</p>}
            {reviewMutation.isError && <PageError message="You can review this shoe after it has been delivered to you." />}
          </form>}
          {reviews.isLoading ? <Loading /> : reviews.isError ? <PageError message="Reviews could not be loaded." /> : (
            <div className="mt-4 space-y-4">{reviews.data?.data.length ? reviews.data.data.map((review) => <ReviewRow key={review.id} review={review} />) : <p className="text-gray-600">No approved reviews yet.</p>}
              {reviews.data?.meta && reviews.data.meta.totalPages > 1 && <div className="flex items-center gap-3"><Button disabled={reviewPage <= 1} onClick={() => setReviewPage((page) => page - 1)}>Previous</Button><span>Page {reviewPage} of {reviews.data.meta.totalPages}</span><Button disabled={reviewPage >= reviews.data.meta.totalPages} onClick={() => setReviewPage((page) => page + 1)}>Next</Button></div>}
            </div>
          )}
        </section>
      </section>
      <Modal title={`${product.data.name} image preview`} open={imagePreviewOpen && !selectedImageUnavailable} onClose={() => setImagePreviewOpen(false)}>
        <img
          className="product-detail__image-preview"
          src={selectedImageUrl}
          alt={product.data.name}
          onError={() => {
            setFailedImageUrl(selectedImageUrl);
            setImagePreviewOpen(false);
          }}
        />
      </Modal>
    </div>
  );
}

function ReviewRow({ review }: { review: Review }) {
  return <article className="border-b pb-3"><p className="font-semibold">{review.userName} · {'★'.repeat(review.rating)}</p><p className="mt-1">{review.comment}</p><time className="text-sm text-gray-500">{formatDate(review.createdAt)}</time></article>;
}

export function CartPage() {
  const { user } = useAuth('customer');
  const client = useQueryClient();
  const [discountCode, setDiscountCode] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const cartKey = cartQueryKey(user?.id);
  const cart = useQuery({ queryKey: cartKey, queryFn: () => loadCart(user?.id) });
  const itemMutation = useMutation({
    mutationFn: ({ productId, sku, quantity }: { productId: string; sku: string; quantity: number }) => user
      ? customerApi.setCartItem(productId, sku, quantity)
      : setGuestCartItem(productId, sku, quantity),
    onMutate: async ({ sku, quantity }) => {
      await client.cancelQueries({ queryKey: cartKey });
      const previous = client.getQueryData<Cart>(cartKey);
      if (previous) {
        const items = quantity === 0
          ? previous.items.filter((item) => item.sku !== sku)
          : previous.items.map((item) => item.sku === sku ? { ...item, quantity } : item);
        client.setQueryData<Cart>(cartKey, { items, subtotal: items.reduce((total, item) => total + item.unitPrice * item.quantity, 0) });
      }
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) client.setQueryData(cartKey, context.previous);
    },
    onSuccess: (data) => client.setQueryData(cartKey, data),
  });
  const discountMutation = useMutation({
    mutationFn: () => customerApi.validateDiscount(discountCode, cart.data?.subtotal ?? 0),
    onMutate: () => setDiscountAmount(0),
    onSuccess: (result) => setDiscountAmount(result.discountAmount),
  });
  if (cart.isLoading) return <Loading />;
  if (cart.isError) return <PageError message="Could not load your cart." />;
  const contents = cart.data as Cart;
  return <div className="storefront-page cart-page"><span className="section-eyebrow">Almost yours</span><PageTitle>Your bag</PageTitle>
    {!contents.items.length ? <><StoreEmpty title="Your bag is waiting" description="Find a pair that feels like you, and it will be right here." /><Link className="mt-4 inline-block underline" to="/shop">Browse the collection</Link></> : <>
      <div className="cart-items">{contents.items.map((item) => <article key={item.sku} className="cart-item">
        <img src={resolveAssetUrl(item.image)} alt="" className="h-24 w-24 rounded-lg object-cover" />
        <div className="cart-item__details"><div><Link to={`/product/${item.productId}`} className="cart-item__name">{item.name}</Link><p className="text-sm text-gray-600">Size {item.size} · {item.color}</p><p className="mt-1 font-medium">{formatNaira(item.unitPrice)}</p>{item.quantity > item.stockAvailable && <p className="text-sm text-red-700">Only {item.stockAvailable} in stock.</p>}</div>
          <div className="flex items-center gap-2"><Button disabled={itemMutation.isPending || item.quantity <= 1} aria-label={`Decrease ${item.name} quantity`} onClick={() => itemMutation.mutate({ productId: item.productId, sku: item.sku, quantity: item.quantity - 1 })}>−</Button><span aria-live="polite" className="min-w-6 text-center">{item.quantity}</span><Button disabled={itemMutation.isPending || item.quantity >= Math.min(item.stockAvailable, 100)} aria-label={`Increase ${item.name} quantity`} onClick={() => itemMutation.mutate({ productId: item.productId, sku: item.sku, quantity: item.quantity + 1 })}>+</Button><Button disabled={itemMutation.isPending} onClick={() => itemMutation.mutate({ productId: item.productId, sku: item.sku, quantity: 0 })}>Remove</Button></div>
        </div>
      </article>)}</div>
      {itemMutation.isError && <PageError message="We couldn't update that quantity. Please check the available stock." />}
      <div className="mt-6 grid gap-8 md:grid-cols-2">
        <form className="flex items-end gap-2" onSubmit={(event) => { event.preventDefault(); discountMutation.mutate(); }}><label className="flex-1">Discount code<Input value={discountCode} onChange={(event) => { setDiscountAmount(0); setDiscountCode(event.target.value.toUpperCase()); }} /></label><Button type="submit" disabled={discountMutation.isPending}>Apply</Button></form>
        {discountMutation.isError && <PageError message="That discount could not be applied." />}
        <div className="cart-summary customer-panel"><p className="section-eyebrow">Your total</p><div className="flex justify-between"><span>Subtotal</span><span>{formatNaira(contents.subtotal)}</span></div>{discountAmount > 0 && <div className="flex justify-between"><span>Discount</span><span>−{formatNaira(discountAmount)}</span></div>}<div className="cart-summary__total"><span>Subtotal after discount</span><strong>{formatNaira(contents.subtotal - discountAmount)}</strong></div><p className="text-xs text-gray-500">Delivery is calculated at checkout.</p><Link to="/checkout" state={{ discountCode: discountAmount ? discountCode : undefined }} className="cart-checkout-link">Continue to checkout <span aria-hidden="true">→</span></Link></div>
      </div>
    </>}
  </div>;
}

export function CheckoutPage() {
  const { user, isLoading: authLoading } = useAuth('customer');
  const navigate = useNavigate();
  const location = useLocation();
  const client = useQueryClient();
  const passedDiscount = (location.state as { discountCode?: string } | null)?.discountCode;
  const [addressId, setAddressId] = useState('');
  const [newAddress, setNewAddress] = useState(false);
  const [shipping, setShipping] = useState<ShippingAddress>({ recipient: user?.name ?? '', phone: user?.phone ?? '', street: '', city: '', state: '', landmark: '' });
  const [guestDetails, setGuestDetails] = useState({ name: '', email: '' });
  const [placedOrderNumber, setPlacedOrderNumber] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'paystack' | 'pay_on_delivery'>('paystack');
  const cartKey = cartQueryKey(user?.id);
  const cart = useQuery({ queryKey: cartKey, queryFn: () => loadCart(user?.id) });
  const addresses = useQuery({ queryKey: ['addresses'], queryFn: customerApi.addresses, enabled: !!user, initialData: user ? undefined : [] });
  const zones = useQuery({ queryKey: ['delivery-zones'], queryFn: customerApi.deliveryZones });
  const savedAddress = addresses.data?.find((address) => address.id === addressId);
  const usingNewAddress = newAddress || !addresses.data?.length;
  const deliveryState = (usingNewAddress ? shipping.state : savedAddress?.state ?? '').trim();
  const activeZones = useMemo(() => zones.data?.filter((zone) => zone.isActive) ?? [], [zones.data]);
  const discount = useQuery({
    queryKey: ['checkout-discount', passedDiscount, cart.data?.subtotal],
    queryFn: () => customerApi.validateDiscount(passedDiscount!, cart.data!.subtotal),
    enabled: !!passedDiscount && !!cart.data?.subtotal,
    retry: false,
  });
  useEffect(() => {
    if (!addressId && addresses.data?.length) {
      const defaultAddress = addresses.data.find((address) => address.isDefault) ?? addresses.data[0];
      setAddressId(defaultAddress.id);
      if (!defaultAddress.state?.trim()) setNewAddress(true);
    }
  }, [addressId, addresses.data]);
  useEffect(() => {
    if (zoneId && !activeZones.some((zone) => zone.id === zoneId)) setZoneId('');
  }, [activeZones, zoneId]);
  const mutation = useMutation({
    mutationFn: () => customerApi.checkout({
      ...(user ? (usingNewAddress ? { shippingAddress: shipping } : { addressId }) : {
        guestDetails,
        items: readGuestCartEntries(),
        shippingAddress: shipping,
      }),
      deliveryZoneId: zoneId,
      paymentMethod,
      ...(passedDiscount && discount.data ? { discountCode: passedDiscount } : {}),
    }),
    onSuccess: (result) => {
      client.setQueryData(cartKey, { items: [], subtotal: 0 });
      if (!user) clearGuestCart();
      if (result.paystack) {
        if (!user && result.guestAccessToken) {
          window.sessionStorage.setItem(`guest-order:${result.paystack.reference}`, result.guestAccessToken);
        }
        window.location.assign(result.paystack.authorizationUrl);
      } else if (user) navigate(`/orders/${result.order.id}`, { replace: true });
      else setPlacedOrderNumber(result.order.orderNumber);
    },
    onError: () => {
      void client.invalidateQueries({ queryKey: cartKey });
    },
  });
  if (authLoading || cart.isLoading || addresses.isLoading || zones.isLoading) return <Loading />;
  if (cart.isError || addresses.isError || zones.isError) return <PageError message="Checkout details could not be loaded. Please try again." />;
  const selectedZone = activeZones.find((zone) => zone.id === zoneId);
  const zoneMatchesAddress = Boolean(deliveryState && selectedZone?.states.some(
    (state) => state.trim().toLowerCase() === deliveryState.toLowerCase(),
  ));
  const subtotal = cart.data?.subtotal ?? 0;
  if (placedOrderNumber) {
    return <div className="storefront-page payment-result"><span className="payment-result__icon">✓</span><span className="section-eyebrow">Order received</span><PageTitle>Thank you for your order</PageTitle><p>Order <strong>{placedOrderNumber}</strong> is being prepared. We sent your confirmation to <strong>{guestDetails.email}</strong>.</p><Link to="/shop">Continue shopping</Link></div>;
  }
  return <div className="storefront-page checkout-page"><span className="section-eyebrow">A few final details</span><PageTitle>Make it yours</PageTitle>
    {!cart.data?.items.length ? <><StoreEmpty title="Your bag is empty" description="Add a pair before checking out." /><Link to="/shop" className="mt-4 inline-block underline">Browse the collection</Link></> : <form onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }} className="checkout-grid grid">
      <div className="space-y-6">
        {!user && <section className="checkout-section"><h2 className="mb-3 text-xl font-bold">Your contact details</h2><div className="grid gap-3 sm:grid-cols-2"><label>Name<Input autoComplete="name" required value={guestDetails.name} onChange={(event) => setGuestDetails((value) => ({ ...value, name: event.target.value }))} /></label><label>Email<Input type="email" autoComplete="email" required value={guestDetails.email} onChange={(event) => setGuestDetails((value) => ({ ...value, email: event.target.value }))} /></label></div></section>}
        <section className="checkout-section"><h2 className="mb-3 text-xl font-bold">Delivery address</h2>
          {addresses.data?.length ? <div className="space-y-2">{addresses.data.map((address) => <label key={address.id} className="flex gap-3 rounded border p-3"><input type="radio" name="address" checked={!usingNewAddress && addressId === address.id} onChange={() => { setAddressId(address.id); setNewAddress(!address.state?.trim()); }} /><span>{address.label}: {address.recipient}, {address.street}, {address.city}, {address.state || 'State required'}</span></label>)}</div> : null}
          {!!addresses.data?.length && <label className="mt-3 flex items-center gap-2"><input type="checkbox" checked={newAddress} onChange={(event) => setNewAddress(event.target.checked)} />Use a new address</label>}
          {usingNewAddress && <div className="mt-3 grid gap-3 sm:grid-cols-2">{(['recipient', 'phone', 'street', 'city', 'state', 'landmark'] as const).map((field) => <label key={field} className={field === 'street' ? 'sm:col-span-2' : ''}>{field === 'recipient' ? 'Recipient' : field.charAt(0).toUpperCase() + field.slice(1)}<Input required={field !== 'landmark'} value={shipping[field] ?? ''} onChange={(event) => setShipping((value) => ({ ...value, [field]: event.target.value }))} /></label>)}</div>}
        </section>
        <section className="checkout-section"><h2 className="mb-3 text-xl font-bold">Delivery option</h2><Select required value={zoneId} onChange={(event) => setZoneId(event.target.value)}><option value="">Choose your delivery zone</option>{activeZones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name} · {formatNaira(zone.fee)} · {zone.estimatedDays}</option>)}</Select><p className="mt-2 text-sm text-gray-500">{!deliveryState ? 'Enter a state to confirm this delivery option.' : !selectedZone ? 'Choose a delivery zone for your address.' : zoneMatchesAddress ? 'Delivery option available for this state.' : `This zone does not cover ${deliveryState}. Choose another zone or address.`}</p></section>
        <section className="checkout-section"><h2 className="mb-3 text-xl font-bold">Payment method</h2><div className="payment-options"><label className={paymentMethod === 'paystack' ? 'is-selected' : ''}><input type="radio" name="payment" checked={paymentMethod === 'paystack'} onChange={() => setPaymentMethod('paystack')} /><span><strong>Pay online</strong><small>Secure checkout with Paystack</small></span></label><label className={paymentMethod === 'pay_on_delivery' ? 'is-selected' : ''}><input type="radio" name="payment" checked={paymentMethod === 'pay_on_delivery'} onChange={() => setPaymentMethod('pay_on_delivery')} /><span><strong>Pay on delivery</strong><small>Pay when your order arrives</small></span></label></div></section>
      </div>
      <aside className="checkout-summary customer-panel">
        <p className="section-eyebrow">Order summary</p>
        <h2>Your selection</h2>
        <div className="checkout-summary__items">{cart.data?.items.map((item) => <p key={item.sku}><span>{item.name} <small>× {item.quantity}</small></span><strong>{formatNaira(item.unitPrice * item.quantity)}</strong></p>)}</div>
        <div className="checkout-summary__totals">
          <p><span>Subtotal</span><span>{formatNaira(subtotal)}</span></p>
          {passedDiscount && discount.data && <p className="checkout-discount"><span>Discount · {passedDiscount}</span><span>−{formatNaira(discount.data.discountAmount)}</span></p>}
          {passedDiscount && discount.isError && <p className="text-sm text-red-700">The discount code could not be applied.</p>}
          <p><span>Delivery</span><span>{selectedZone ? formatNaira(selectedZone.fee) : 'Choose a zone'}</span></p>
          <p className="checkout-total"><strong>Total</strong><strong>{formatNaira(subtotal - (discount.data?.discountAmount ?? 0) + (selectedZone?.fee ?? 0))}</strong></p>
        </div>
        <Button type="submit" disabled={mutation.isPending || !selectedZone || !zoneMatchesAddress || discount.isLoading} className="storefront-submit">{mutation.isPending ? 'Placing your order…' : 'Place order securely'}</Button>
        {mutation.isError && <PageError message={mutation.error instanceof Error ? mutation.error.message : 'We could not place your order. Please try again.'} />}
        <p className="checkout-reassurance">Your payment details are protected. Your shoes are just around the corner.</p>
      </aside>
    </form>}
  </div>;
}

export function VerifyPaymentPage() {
  const [params] = useSearchParams();
  const reference = params.get('reference') ?? '';
  const [guestVerification, setGuestVerification] = useState(() => ({
    reference,
    token: reference ? window.sessionStorage.getItem(`guest-order:${reference}`) : null,
  }));
  useEffect(() => {
    setGuestVerification({
      reference,
      token: reference ? window.sessionStorage.getItem(`guest-order:${reference}`) : null,
    });
  }, [reference]);
  const guestToken = guestVerification.reference === reference ? guestVerification.token : null;
  const result = useQuery({
    queryKey: ['payment-verify', reference, guestToken ? 'guest' : 'customer'],
    queryFn: async () => {
      if (!guestToken) return customerApi.verifyPayment(reference);
      return customerApi.verifyGuestPayment(reference, guestToken);
    },
    enabled: !!reference,
    retry: false,
  });
  if (!reference) return <div className="storefront-page"><PageError message="Payment reference is missing." /></div>;
  if (result.isLoading) return <div className="py-16 text-center"><Loading /><p>Confirming your payment…</p></div>;
  if (result.isError || !result.data) return <div className="storefront-page payment-result"><PageError message="We could not confirm this payment yet. If your payment went through, check your email for an update." />{guestToken ? <Link to="/shop">Continue shopping</Link> : <Link to="/orders">View my orders</Link>}</div>;
  return <div className="storefront-page payment-result"><span className="payment-result__icon">✓</span><span className="section-eyebrow">All settled</span><h1>Payment confirmed</h1><p>Order <strong>{result.data.orderNumber}</strong> is being prepared.</p>{guestToken ? <Link to="/shop">Continue shopping <span aria-hidden="true">→</span></Link> : <Link to={`/orders/${result.data.id}`}>View order details <span aria-hidden="true">→</span></Link>}</div>;
}

export function OrdersPage() {
  const orders = useQuery({ queryKey: ['orders'], queryFn: () => customerApi.orders() });
  const returns = useQuery({ queryKey: ['returns'], queryFn: customerApi.returns });
  if (orders.isLoading) return <div className="storefront-page orders-page"><ProfileBackLink /><Loading /></div>;
  if (orders.isError || returns.isError) return <div className="storefront-page orders-page"><ProfileBackLink /><PageError message="Could not load your orders." /></div>;
  return <div className="storefront-page orders-page"><ProfileBackLink /><span className="section-eyebrow">The journey so far</span><PageTitle>Your orders</PageTitle>
    {!orders.data?.data.length ? <><StoreEmpty title="No orders just yet" description="When you find your next favorite pair, your order details will live here." /><Link to="/shop" className="mt-4 inline-block underline">Explore the collection</Link></> : <div className="order-list">{orders.data.data.map((order) => <Link key={order.id} to={`/orders/${order.id}`} className="order-row"><span><strong>{order.orderNumber}</strong><small>Placed {formatDate(order.createdAt)}</small></span><span className="order-row__end"><StatusBadge status={order.status} />{formatNaira(order.total)}<span aria-hidden="true">→</span></span></Link>)}</div>}
    <section className="mt-8"><h2 className="mb-3 text-xl font-bold">My returns</h2>{returns.isLoading ? <Loading /> : returns.data?.length ? <div className="space-y-2">{returns.data.map((request) => <div key={request.id} className="flex flex-wrap justify-between gap-3 rounded border p-3"><span>{request.orderNumber} · {request.reason}</span><span className="capitalize">{request.status}</span></div>)}</div> : <p className="text-gray-600">No return requests yet.</p>}</section>
  </div>;
}

export function OrderDetailPage() {
  const { id = '' } = useParams();
  const client = useQueryClient();
  const orderQuery = useQuery({ queryKey: ['order', id], queryFn: () => customerApi.order(id) });
  const returns = useQuery({ queryKey: ['returns'], queryFn: customerApi.returns });
  const [reason, setReason] = useState('');
  const [returnSku, setReturnSku] = useState('');
  const [returnQuantity, setReturnQuantity] = useState(1);
  const cancel = useMutation({ mutationFn: () => customerApi.cancelOrder(id), onSuccess: (order) => { client.setQueryData(['order', id], order); void client.invalidateQueries({ queryKey: ['orders'] }); } });
  const paymentVerification = useMutation({
    mutationFn: customerApi.verifyPayment,
    onSuccess: (order) => {
      client.setQueryData(['order', id], order);
      void client.invalidateQueries({ queryKey: ['orders'] });
    },
  });
  const returnMutation = useMutation({
    mutationFn: () => customerApi.createReturn({ orderId: id, items: [{ sku: returnSku, quantity: returnQuantity }], reason }),
    onSuccess: () => { setReason(''); void client.invalidateQueries({ queryKey: ['returns'] }); },
  });
  if (orderQuery.isLoading || returns.isLoading) return <Loading />;
  if (orderQuery.isError || !orderQuery.data) return <PageError message="Order could not be found." />;
  const order = orderQuery.data;
  const canCancel = order.status === 'pending_payment' || order.status === 'paid';
  const canVerifyPayment = order.paymentMethod === 'paystack' && order.status === 'pending_payment';
  return <div className="storefront-page order-detail-page"><span className="section-eyebrow">Order details</span><PageTitle>{order.orderNumber}</PageTitle>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"><div><StatusBadge status={order.status} /><p className="mt-2 text-sm text-gray-600">Placed {formatDateTime(order.createdAt)}</p></div><div className="flex flex-wrap gap-2">{canVerifyPayment && <Button disabled={paymentVerification.isPending} onClick={() => paymentVerification.mutate(order.orderNumber)}>{paymentVerification.isPending ? 'Checking payment…' : 'Check payment status'}</Button>}{canCancel && <Button disabled={cancel.isPending} onClick={() => { if (window.confirm('Cancel this order?')) cancel.mutate(); }}>Cancel order</Button>}</div></div>
    {cancel.isError && <PageError message="This order could not be cancelled." />}
    {paymentVerification.isError && <PageError message="Payment is not confirmed yet. Please try again shortly." />}
    {paymentVerification.isSuccess && <p className="mt-3" role="status">Payment confirmed. Your order is now paid.</p>}
    <section className="my-6"><h2 className="mb-3 text-xl font-bold">Order progress</h2><ol className="space-y-3 border-l-2 border-gray-200 pl-5">{order.statusHistory.map((entry, index) => <li key={`${entry.at}-${index}`}><p className="font-medium capitalize">{entry.status.replace(/_/g, ' ')}</p><time className="text-sm text-gray-600">{formatDateTime(entry.at)}</time>{entry.note && <p>{entry.note}</p>}</li>)}</ol></section>
    <div className="grid gap-6 md:grid-cols-2"><section><h2 className="mb-3 text-xl font-bold">Items</h2>{order.items.map((item) => <div key={item.sku} className="flex gap-3 border-b py-3"><img src={resolveAssetUrl(item.image)} alt="" className="h-16 w-16 rounded object-cover" /><div className="flex-1"><p className="font-medium">{item.name}</p><p className="text-sm text-gray-600">Size {item.size} · {item.color} · Qty {item.quantity}</p></div><span>{formatNaira(item.unitPrice * item.quantity)}</span></div>)}</section>
      <aside><h2 className="mb-3 text-xl font-bold">Summary & delivery</h2><p>{order.shippingAddress.recipient}<br />{order.shippingAddress.street}, {order.shippingAddress.city}, {order.shippingAddress.state}<br />{order.shippingAddress.phone}</p><div className="mt-4 space-y-2 border-t pt-3"><p className="flex justify-between"><span>Subtotal</span><span>{formatNaira(order.subtotal)}</span></p><p className="flex justify-between"><span>Discount</span><span>−{formatNaira(order.discountAmount)}</span></p><p className="flex justify-between"><span>Delivery</span><span>{formatNaira(order.deliveryFee)}</span></p><p className="flex justify-between font-bold"><span>Total</span><span>{formatNaira(order.total)}</span></p><p className="text-sm">Payment: {order.paymentMethod.replace(/_/g, ' ')} · {order.paymentStatus}</p></div></aside>
    </div>
    {order.status === 'delivered' && <section className="customer-panel mt-8"><h2 className="text-xl font-bold">Request a return</h2>{returns.data?.some((request) => request.orderId === order.id) ? <p className="mt-2">A return request has already been submitted for this order.</p> : <form className="mt-3 space-y-3" onSubmit={(event) => { event.preventDefault(); returnMutation.mutate(); }}><Select required value={returnSku} onChange={(event) => setReturnSku(event.target.value)}><option value="">Choose an item</option>{order.items.map((item) => <option key={item.sku} value={item.sku}>{item.name} · {item.sku}</option>)}</Select><Input required min="1" max={order.items.find((item) => item.sku === returnSku)?.quantity ?? 1} type="number" aria-label="Return quantity" value={returnQuantity} onChange={(event) => setReturnQuantity(Number(event.target.value))} /><textarea required minLength={5} aria-label="Reason for return" placeholder="Tell us why you'd like to return this item" rows={3} value={reason} onChange={(event) => setReason(event.target.value)} /><Button type="submit" disabled={returnMutation.isPending || !returnSku}>Submit return request</Button>{returnMutation.isError && <PageError message="Could not submit your return request." />}{returnMutation.isSuccess && <p role="status">Return request submitted.</p>}</form>}</section>}
  </div>;
}

export function WishlistPage() {
  const { user } = useAuth('customer');
  const client = useQueryClient();
  const ids = useQuery({ queryKey: ['wishlist'], queryFn: customerApi.wishlist });
  const products = useQuery({ queryKey: ['wishlist-products', ids.data], queryFn: () => Promise.all((ids.data ?? []).map((id) => customerApi.product(id))), enabled: !!ids.data?.length });
  const remove = useMutation({
    mutationFn: (id: string) => customerApi.toggleWishlist(id, true),
    onSuccess: (nextIds) => {
      client.setQueryData(['wishlist'], nextIds);
      void client.invalidateQueries({ queryKey: ['wishlist-products'] });
    },
  });
  if (ids.isLoading || (products.isLoading && !!ids.data?.length)) return <div className="storefront-page wishlist-page"><ProfileBackLink /><Loading /></div>;
  if (ids.isError || products.isError) return <div className="storefront-page wishlist-page"><ProfileBackLink /><PageError message="Could not load your wishlist." /></div>;
  return <div className="storefront-page wishlist-page"><ProfileBackLink /><span className="section-eyebrow">Saved for later</span><PageTitle>Your wishlist</PageTitle>{!ids.data?.length ? <><StoreEmpty title="Your wishlist is empty" description="Keep the pairs you love close by and come back when you're ready." /><Link to="/shop" className="mt-4 inline-block underline">Browse the collection</Link></> : <div className="shoe-grid">{(products.data ?? []).map((product) => <ProductCard key={product.id} product={product} onRemove={() => remove.mutate(product.id)} />)}</div>}{remove.isError && <PageError message="Could not update your wishlist." />}{!user && <p className="mt-3 text-sm text-gray-600">Sign in to keep your wishlist saved.</p>}</div>;
}

export function LegacyAccountPage() {
  const client = useQueryClient();
  const profile = useQuery({ queryKey: ['profile'], queryFn: customerApi.profile });
  const addresses = useQuery({ queryKey: ['addresses'], queryFn: customerApi.addresses });
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [newAddress, setNewAddress] = useState<Omit<Address, 'id'>>({ label: '', recipient: '', phone: '', street: '', city: '', state: '', landmark: '', isDefault: false });
  const [editingAddressId, setEditingAddressId] = useState('');
  const [editingAddress, setEditingAddress] = useState<Partial<Omit<Address, 'id'>>>({});
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const profileMutation = useMutation({ mutationFn: () => customerApi.updateProfile({ name, phone }), onSuccess: (user) => { client.setQueryData(['profile'], user); setName(user.name); setPhone(user.phone ?? ''); } });
  const addressMutation = useMutation({ mutationFn: () => customerApi.addAddress(newAddress), onSuccess: () => { setNewAddress({ label: '', recipient: '', phone: '', street: '', city: '', state: '', landmark: '', isDefault: false }); void client.invalidateQueries({ queryKey: ['addresses'] }); } });
  const deleteAddress = useMutation({ mutationFn: customerApi.deleteAddress, onSuccess: () => void client.invalidateQueries({ queryKey: ['addresses'] }) });
  const updateAddress = useMutation({
    mutationFn: () => customerApi.updateAddress(editingAddressId, editingAddress),
    onSuccess: () => {
      setEditingAddressId('');
      setEditingAddress({});
      void client.invalidateQueries({ queryKey: ['addresses'] });
    },
  });
  const passwordMutation = useMutation({ mutationFn: () => customerApi.changePassword({ currentPassword, newPassword }), onSuccess: () => { setCurrentPassword(''); setNewPassword(''); } });
  useEffect(() => {
    if (profile.data) {
      setName(profile.data.name);
      setPhone(profile.data.phone ?? '');
    }
  }, [profile.data]);
  if (profile.isLoading || addresses.isLoading) return <Loading />;
  if (profile.isError || addresses.isError || !profile.data) return <PageError message="Could not load your account." />;
  const firstName = profile.data.name.trim().split(/\s+/)[0] || 'there';
  return (
    <div className="storefront-page account-page">
      <header className="account-heading">
        <div>
          <span className="section-eyebrow">Your space</span>
          <h1>Account overview</h1>
          <p>Manage your personal details, delivery addresses, and sign-in security.</p>
        </div>
        <Link className="account-heading__shop" to="/shop">Continue shopping <span aria-hidden="true">→</span></Link>
      </header>

      <section className="account-welcome" aria-label="Profile summary">
        <div className="account-avatar" aria-hidden="true">{profile.data.name.trim().charAt(0).toUpperCase()}</div>
        <div className="account-welcome__identity">
          <span className="account-welcome__eyebrow">Welcome back</span>
          <h2>{firstName}</h2>
          <p>{profile.data.email}</p>
        </div>
        <div className="account-welcome__since">
          <span>Member since</span>
          <strong>{formatDate(profile.data.createdAt)}</strong>
        </div>
      </section>

      <div className="account-layout">
        <nav className="account-menu" aria-label="Account sections">
          <span className="account-menu__title">Your account</span>
          <a href="#personal-details" className="is-active">Personal details</a>
          <a href="#address-book">Address book <span>{addresses.data?.length ?? 0}</span></a>
          <a href="#account-security">Password & security</a>
          <span className="account-menu__divider" />
          <Link to="/orders">Your orders <span aria-hidden="true">↗</span></Link>
          <Link to="/wishlist">Saved items <span aria-hidden="true">↗</span></Link>
        </nav>

        <div className="account-content">
          <section className="customer-panel account-card" id="personal-details">
            <div className="account-card__heading">
              <div><span className="account-card__eyebrow">PROFILE</span><h2>Personal details</h2></div>
              <p>Your contact information for orders and delivery.</p>
            </div>
            <form className="account-form" onSubmit={(event) => { event.preventDefault(); profileMutation.mutate(); }}>
              <label>
                Full name
                <Input required autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} />
              </label>
              <label>
                Email address
                <Input type="email" autoComplete="email" value={profile.data.email} disabled />
                <small className="account-field-hint">Email address cannot be changed here.</small>
              </label>
              <label>
                Phone number
                <Input type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Add a phone number" />
              </label>
              <div className="account-form__actions">
                {profileMutation.isSuccess && <p role="status" className="account-success">Your profile has been updated.</p>}
                {profileMutation.isError && <PageError message="Could not save your profile." />}
                <Button type="submit" disabled={profileMutation.isPending}>{profileMutation.isPending ? 'Saving…' : 'Save changes'}</Button>
              </div>
            </form>
          </section>

          <section className="customer-panel account-card" id="address-book">
            <div className="account-card__heading">
              <div><span className="account-card__eyebrow">DELIVERY</span><h2>Address book</h2></div>
              <p>Keep your delivery details ready for a quicker checkout.</p>
            </div>
            {addresses.data?.length ? (
              <div className="account-addresses">
                {addresses.data.map((address) => (
                  <article key={address.id} className="account-address">
                    <div className="account-address__top">
                      <div><h3>{address.label || 'Delivery address'}</h3>{address.isDefault && <span className="account-default-badge">Default</span>}</div>
                      <div className="account-address__actions">
                        <Button type="button" variant="secondary" onClick={() => { setEditingAddressId(address.id); setEditingAddress({ label: address.label, recipient: address.recipient, phone: address.phone, street: address.street, city: address.city, state: address.state, landmark: address.landmark, isDefault: address.isDefault }); }}>Edit</Button>
                        <Button type="button" variant="secondary" disabled={deleteAddress.isPending} onClick={() => { if (window.confirm('Delete this address?')) deleteAddress.mutate(address.id); }}>Remove</Button>
                      </div>
                    </div>
                    <p>{address.recipient}<br />{address.street}{address.landmark ? `, ${address.landmark}` : ''}<br />{address.city}, {address.state}<br />{address.phone}</p>
                    {editingAddressId === address.id && (
                      <form className="account-form account-form--address" onSubmit={(event) => { event.preventDefault(); updateAddress.mutate(); }}>
                        {(['label', 'recipient', 'phone', 'street', 'city', 'state', 'landmark'] as const).map((field) => (
                          <label key={field}>{field === 'label' ? 'Address label' : field.charAt(0).toUpperCase() + field.slice(1)}
                            <Input required={field !== 'landmark'} value={editingAddress[field] ?? ''} onChange={(event) => setEditingAddress((value) => ({ ...value, [field]: event.target.value }))} />
                          </label>
                        ))}
                        <label className="account-checkbox"><input type="checkbox" checked={editingAddress.isDefault ?? false} onChange={(event) => setEditingAddress((value) => ({ ...value, isDefault: event.target.checked }))} />Make this my default address</label>
                        <div className="account-form__actions">
                          {updateAddress.isError && <PageError message="Could not update this address." />}
                          <Button type="submit" disabled={updateAddress.isPending}>{updateAddress.isPending ? 'Saving…' : 'Save address'}</Button>
                          <Button type="button" variant="secondary" onClick={() => setEditingAddressId('')}>Cancel</Button>
                        </div>
                      </form>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <div className="account-address-empty"><strong>No saved addresses yet</strong><span>Add a delivery address below to speed up your next checkout.</span></div>
            )}
            {deleteAddress.isError && <PageError message="Could not remove this address." />}
            <details className="account-add-address">
              <summary>Add a delivery address</summary>
              <form className="account-form account-form--address" onSubmit={(event) => { event.preventDefault(); addressMutation.mutate(); }}>
                {(['label', 'recipient', 'phone', 'street', 'city', 'state', 'landmark'] as const).map((field) => (
                  <label key={field}>{field === 'label' ? 'Address label' : field.charAt(0).toUpperCase() + field.slice(1)}
                    <Input required={field !== 'landmark'} value={newAddress[field] ?? ''} onChange={(event) => setNewAddress((value) => ({ ...value, [field]: event.target.value }))} />
                  </label>
                ))}
                <label className="account-checkbox"><input type="checkbox" checked={newAddress.isDefault} onChange={(event) => setNewAddress((value) => ({ ...value, isDefault: event.target.checked }))} />Make this my default address</label>
                <div className="account-form__actions">
                  {addressMutation.isError && <PageError message="Could not add this address." />}
                  <Button type="submit" disabled={addressMutation.isPending}>{addressMutation.isPending ? 'Adding…' : 'Add address'}</Button>
                </div>
              </form>
            </details>
          </section>

          <section className="customer-panel account-card" id="account-security">
            <div className="account-card__heading">
              <div><span className="account-card__eyebrow">SECURITY</span><h2>Password & security</h2></div>
              <p>Choose a strong password to help keep your account secure.</p>
            </div>
            <form className="account-form account-form--security" onSubmit={(event) => { event.preventDefault(); passwordMutation.mutate(); }}>
              <label>
                Current password
                <Input type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
              </label>
              <label>
                New password
                <Input type="password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
                <small className="account-field-hint">Use at least 8 characters.</small>
              </label>
              <div className="account-form__actions">
                {passwordMutation.isSuccess && <p role="status" className="account-success">Your password has been updated.</p>}
                {passwordMutation.isError && <PageError message="Could not change your password. Check your current password and try again." />}
                <Button type="submit" disabled={passwordMutation.isPending}>{passwordMutation.isPending ? 'Updating…' : 'Update password'}</Button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}

type LoginReturn = { from?: string | { pathname?: string; search?: string; hash?: string } };

function destination(userRole?: string, state?: LoginReturn) {
  if (typeof state?.from === 'string' && state.from.startsWith('/') && !state.from.startsWith('//')) return state.from;
  if (state?.from && typeof state.from === 'object') return `${state.from.pathname ?? '/'}${state.from.search ?? ''}${state.from.hash ?? ''}`;
  if (userRole === 'admin') return '/admin';
  if (userRole === 'owner') return '/owner';
  return '/';
}

export function LoginPage() {
  const { login, user } = useAuth('customer');
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  if (user) return <NavigateAfterLogin role={user.role} from={location.state as LoginReturn | null} />;
  return <div className="storefront-page"><div className="customer-auth-card"><span className="section-eyebrow">Welcome back</span><PageTitle>Sign in</PageTitle><form className="space-y-4" onSubmit={async (event) => { event.preventDefault(); setError(''); try { await login(email, password); } catch (loginError) { setError(loginError instanceof ApiClientError && loginError.status === 403 ? loginError.message : 'Email or password is incorrect.'); } }}><label>Email<Input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Password<Input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>{error && <PageError message={error} />}<Button type="submit">Sign in</Button></form><div className="customer-auth-card__links"><Link to="/forgot-password">Forgot password?</Link><Link to="/register">Create account</Link></div><p className="mt-5 text-sm text-gray-600">Staff? <Link to="/admin/login" className="font-semibold underline">Staff sign in</Link></p></div></div>;
}

function NavigateAfterLogin({ role, from }: { role: string; from: LoginReturn | null }) {
  const to = destination(role, from ?? undefined);
  return <Navigate to={to} replace />;
}

export function RegisterPage() {
  const { register, user } = useAuth('customer');
  const navigate = useNavigate();
  const location = useLocation();
  const [fields, setFields] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  if (user) return <NavigateAfterLogin role={user.role} from={location.state as LoginReturn | null} />;
  return <div className="storefront-page"><div className="customer-auth-card"><span className="section-eyebrow">Start somewhere lovely</span><PageTitle>Create your account</PageTitle><form className="space-y-4" onSubmit={async (event) => { event.preventDefault(); setError(''); try { await register({ ...fields, phone: fields.phone || undefined }); navigate('/'); } catch { setError('We could not create your account. Check your details and try again.'); } }}><label>Name<Input required minLength={2} autoComplete="name" value={fields.name} onChange={(event) => setFields((v) => ({ ...v, name: event.target.value }))} /></label><label>Email<Input required type="email" autoComplete="email" value={fields.email} onChange={(event) => setFields((v) => ({ ...v, email: event.target.value }))} /></label><label>Phone (optional)<Input autoComplete="tel" value={fields.phone} onChange={(event) => setFields((v) => ({ ...v, phone: event.target.value }))} /></label><label>Password<Input required minLength={8} type="password" autoComplete="new-password" value={fields.password} onChange={(event) => setFields((v) => ({ ...v, password: event.target.value }))} /></label>{error && <PageError message={error} />}<Button type="submit" className="storefront-submit">Create account</Button></form><p className="mt-4 text-sm">Already have an account? <Link to="/login" className="underline">Sign in</Link></p></div></div>;
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const mutation = useMutation({ mutationFn: () => customerApi.forgotPassword(email) });
  return <div className="storefront-page"><div className="customer-auth-card"><span className="section-eyebrow">Account access</span><PageTitle>Reset your password</PageTitle><p className="mb-4 text-gray-600">Enter your email and we’ll send you a reset link if an account exists.</p><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}><label>Email<Input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><Button type="submit" disabled={mutation.isPending}>Send reset link</Button></form>{mutation.isSuccess && <p role="status" className="mt-4">If that email is registered, a reset link is on its way.</p>}{mutation.isError && <PageError message="Could not request a reset link. Please try again." />}</div></div>;
}

export function ResetPasswordPage() {
  const [search] = useSearchParams();
  const [password, setPassword] = useState('');
  const [done, setDone] = useState(false);
  const mutation = useMutation({ mutationFn: () => customerApi.resetPassword(search.get('token') ?? '', password), onSuccess: () => setDone(true) });
  return <div className="storefront-page"><div className="customer-auth-card"><span className="section-eyebrow">Almost there</span><PageTitle>Choose a new password</PageTitle>{done ? <p role="status">Password reset. <Link to="/login" className="underline">Sign in</Link></p> : <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}><label>New password<Input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>{!search.get('token') && <PageError message="This reset link is missing its token. Request a new link to continue." />}<Button type="submit" disabled={mutation.isPending || !search.get('token')}>Reset password</Button>{mutation.isError && <PageError message="This reset link may be invalid or expired." />}</form>}</div></div>;
}
