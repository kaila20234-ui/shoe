import { http, HttpResponse } from 'msw';
import type {
  Address,
  ApiFailure,
  ApiSuccess,
  AuthPayload,
  Cart,
  CartItem,
  DeliveryZone,
  Order,
  Product,
  ProductFilterMeta,
  Review,
  ReturnRequest,
  User,
} from '../../shared/types';

const now = new Date().toISOString();
let customer: User = {
  id: 'user-customer-1',
  name: 'Ada Okafor',
  email: 'customer@shoestore.test',
  phone: '+2348012345678',
  role: 'customer',
  isActive: true,
  addresses: [],
  wishlist: [],
  createdAt: now,
  updatedAt: now,
};
const admin: User = {
  id: 'user-admin-1',
  name: 'Shoe Store Admin',
  email: 'admin@shoestore.test',
  role: 'admin',
  isActive: true,
  addresses: [],
  wishlist: [],
  createdAt: now,
  updatedAt: now,
};
const owner: User = {
  id: 'user-owner-1',
  name: 'Shoe Store Owner',
  email: 'owner@shoestore.test',
  role: 'owner',
  isActive: true,
  addresses: [],
  wishlist: [],
  createdAt: now,
  updatedAt: now,
};

const products: Product[] = [
  {
    id: 'product-air-runner',
    name: 'Air Runner Classic',
    slug: 'air-runner-classic',
    description: 'Lightweight everyday sneakers with a cushioned sole and breathable mesh upper.',
    brand: 'Apex',
    audience: 'men',
    type: 'sneakers',
    price: 4850000,
    salePrice: 4250000,
    images: ['https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=900', 'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=900'],
    variants: [
      { sku: 'APX-AR-42-RED', size: 42, color: 'Red', stock: 8 },
      { sku: 'APX-AR-43-RED', size: 43, color: 'Red', stock: 4 },
      { sku: 'APX-AR-42-BLK', size: 42, color: 'Black', stock: 0 },
    ],
    isActive: true,
    ratingAverage: 4.7,
    ratingCount: 18,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'product-everyday-flat',
    name: 'Everyday Leather Flat',
    slug: 'everyday-leather-flat',
    description: 'A comfortable leather flat made for commutes, errands, and long days on your feet.',
    brand: 'Sola',
    audience: 'women',
    type: 'formal',
    price: 3650000,
    images: ['https://images.unsplash.com/photo-1543163521-1bf539c55dd?w=900', 'https://images.unsplash.com/photo-1535043934128-cf0b28d52f95?w=900'],
    variants: [
      { sku: 'SOL-EF-38-TAN', size: 38, color: 'Tan', stock: 5 },
      { sku: 'SOL-EF-39-TAN', size: 39, color: 'Tan', stock: 7 },
    ],
    isActive: true,
    ratingAverage: 4.5,
    ratingCount: 12,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'product-kids-sprint',
    name: 'Kids Sprint Velcro',
    slug: 'kids-sprint-velcro',
    description: 'Easy-on trainers for little feet, with a supportive heel and grippy rubber outsole.',
    brand: 'Apex',
    audience: 'kids',
    type: 'sports',
    price: 2180000,
    salePrice: 1950000,
    images: ['https://images.unsplash.com/photo-1519861155730-0b5fbf0dd889?w=900'],
    variants: [
      { sku: 'APX-KS-30-BLU', size: 30, color: 'Blue', stock: 3 },
      { sku: 'APX-KS-31-BLU', size: 31, color: 'Blue', stock: 6 },
    ],
    isActive: true,
    ratingAverage: 4.8,
    ratingCount: 9,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'product-city-sandal',
    name: 'City Walk Sandal',
    slug: 'city-walk-sandal',
    description: 'A versatile, adjustable sandal with a soft footbed for sunny days.',
    brand: 'Sola',
    audience: 'women',
    type: 'sandals',
    price: 2890000,
    images: ['https://images.unsplash.com/photo-1562273138-f46be4ebdf33?w=900'],
    variants: [{ sku: 'SOL-CW-39-BRN', size: 39, color: 'Brown', stock: 0 }],
    isActive: true,
    ratingAverage: 4.2,
    ratingCount: 5,
    createdAt: now,
    updatedAt: now,
  },
];

const zones: DeliveryZone[] = [
  { id: 'zone-lagos', name: 'Lagos Mainland', states: ['Lagos'], fee: 150000, estimatedDays: '1-2 days', isActive: true },
  { id: 'zone-southwest', name: 'South-West', states: ['Ogun', 'Oyo', 'Osun', 'Ondo', 'Ekiti'], fee: 350000, estimatedDays: '2-4 days', isActive: true },
  { id: 'zone-nigeria', name: 'Rest of Nigeria', states: ['Abuja', 'Rivers', 'Kano', 'Kaduna'], fee: 600000, estimatedDays: '3-7 days', isActive: true },
];

const reviews: Review[] = [
  { id: 'review-1', productId: 'product-air-runner', userId: 'user-2', userName: 'Tunde A.', rating: 5, comment: 'Very comfortable and just as pictured.', status: 'approved', createdAt: now },
  { id: 'review-2', productId: 'product-everyday-flat', userId: 'user-3', userName: 'Ngozi E.', rating: 4, comment: 'Great fit and fast delivery.', status: 'approved', createdAt: now },
];

const addresses: Address[] = [
  { id: 'address-1', label: 'Home', recipient: customer.name, phone: customer.phone ?? '', street: '14 Allen Avenue', city: 'Ikeja', state: 'Lagos', isDefault: true },
];
let activeUser: User | null = null;
let cartItems: CartItem[] = [];
let wishlistIds: string[] = [];
let orders: Order[] = [];
let returnRequests: ReturnRequest[] = [];
let seededCustomerPassword = 'Passw0rd!123';
let pendingResetEmail = '';
const registeredUsers = new Map<string, { user: User; password: string }>();

function success<T>(data: T, meta?: ApiSuccess<T>['meta']) {
  const body: ApiSuccess<T> = { success: true, data, ...(meta ? { meta } : {}) };
  return HttpResponse.json(body);
}

function failure(code: ApiFailure['error']['code'], message: string, status: number) {
  const body: ApiFailure = { success: false, error: { code, message } };
  return HttpResponse.json(body, { status });
}

function paged<T>(values: T[], url: URL) {
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 20));
  const start = (page - 1) * limit;
  return success(values.slice(start, start + limit), {
    page,
    limit,
    total: values.length,
    totalPages: Math.ceil(values.length / limit),
  });
}

function buildCart(): Cart {
  const items = cartItems.flatMap((item) => {
    const product = products.find((candidate) => candidate.id === item.productId && candidate.isActive);
    const variant = product?.variants.find((candidate) => candidate.sku === item.sku);
    if (!product || !variant) return [];
    return [{
      ...item,
      name: product.name,
      image: product.images[0],
      size: variant.size,
      color: variant.color,
      unitPrice: product.salePrice ?? product.price,
      stockAvailable: variant.stock,
    }];
  });
  cartItems = items;
  return { items, subtotal: items.reduce((total, item) => total + item.unitPrice * item.quantity, 0) };
}

function makeOrder(body: {
  shippingAddress?: Order['shippingAddress'];
  addressId?: string;
  deliveryZoneId: string;
  paymentMethod: Order['paymentMethod'];
  discountCode?: string;
}): Order | null {
  const cart = buildCart();
  const zone = zones.find((candidate) => candidate.id === body.deliveryZoneId);
  if (!cart.items.length || !zone) return null;
  const address = body.addressId ? addresses.find((candidate) => candidate.id === body.addressId) : undefined;
  const shippingAddress = body.shippingAddress ?? (address ? {
    recipient: address.recipient, phone: address.phone, street: address.street,
    city: address.city, state: address.state, landmark: address.landmark,
  } : undefined);
  if (!shippingAddress) return null;

  const discountAmount = body.discountCode?.toUpperCase() === 'WELCOME10' ? Math.floor(cart.subtotal * 0.1) : 0;
  const orderNumber = `SS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Math.floor(10000 + Math.random() * 90000))}`;
  const order: Order = {
    id: `order-${Date.now()}`,
    orderNumber,
    customerId: activeUser?.id ?? customer.id,
    customerName: activeUser?.name ?? customer.name,
    customerEmail: activeUser?.email ?? customer.email,
    items: cart.items.map(({ productId, sku, name, image, size, color, unitPrice, quantity }) => ({ productId, sku, name, image, size, color, unitPrice, quantity })),
    subtotal: cart.subtotal,
    ...(discountAmount ? { discountCode: body.discountCode } : {}),
    discountAmount,
    deliveryFee: zone.fee,
    total: cart.subtotal - discountAmount + zone.fee,
    shippingAddress,
    deliveryZoneId: zone.id,
    paymentMethod: body.paymentMethod,
    paymentStatus: 'unpaid',
    status: 'pending_payment',
    statusHistory: [{ status: 'pending_payment', at: now }],
    createdAt: now,
    updatedAt: now,
  };
  for (const item of cart.items) {
    const product = products.find((candidate) => candidate.id === item.productId);
    const variant = product?.variants.find((candidate) => candidate.sku === item.sku);
    if (variant) variant.stock = Math.max(0, variant.stock - item.quantity);
  }
  cartItems = [];
  orders = [order, ...orders];
  return order;
}

function authPayload(user: User): AuthPayload {
  activeUser = user;
  return { token: `mock-token-${user.id}`, user };
}

function isAuthenticated(request: Request) {
  return request.headers.get('Authorization')?.startsWith('Bearer mock-token-') === true && activeUser !== null;
}

function isCustomer(request: Request) {
  return isAuthenticated(request) && activeUser?.role === 'customer';
}

function customerAuthFailure(request: Request) {
  return isAuthenticated(request)
    ? failure('FORBIDDEN', 'Customer access required', 403)
    : failure('UNAUTHENTICATED', 'Sign in required', 401);
}

export const handlers = [
  http.all(/\/api\/(?:auth|users|products|cart|wishlist|delivery-zones|discounts|checkout|orders|payments|returns)(?:\/|$)/, async ({ request }) => {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api(?=\/|$)/, '') || '/';
    const method = request.method.toUpperCase();
    const json = async <T,>() => request.json() as Promise<T>;

    if (!url.pathname.includes('/api/')) return;

    if (method === 'POST' && path === '/auth/login') {
      const body = await json<{ email: string; password: string }>();
      const email = body.email.toLowerCase();
      const registered = registeredUsers.get(email);
      const seededUser = [customer, admin, owner].find((candidate) => candidate.email === email);
      const seededPassword = seededUser?.email === customer.email ? seededCustomerPassword : 'Passw0rd!123';
      const user = seededUser && body.password === seededPassword ? seededUser : registered?.password === body.password ? registered.user : null;
      if (!user) return failure('UNAUTHENTICATED', 'Invalid email or password', 401);
      return success(authPayload(user));
    }
    if (method === 'POST' && path === '/auth/register') {
      const body = await json<{ name: string; email: string; phone?: string; password: string }>();
      const email = body.email.toLowerCase();
      if ([customer, admin, owner].some((account) => account.email === email) || registeredUsers.has(email)) return failure('CONFLICT', 'Email is already registered', 409);
      const user: User = { ...customer, id: `user-${Date.now()}`, name: body.name, email, phone: body.phone, addresses: [], wishlist: [], createdAt: now, updatedAt: now };
      registeredUsers.set(email, { user, password: body.password });
      return success(authPayload(user));
    }
    if (method === 'POST' && path === '/auth/forgot-password') {
      const body = await json<{ email: string }>();
      const email = body.email.toLowerCase();
      if (email === customer.email || registeredUsers.has(email)) pendingResetEmail = email;
      return success({});
    }
    if (method === 'POST' && path === '/auth/reset-password') {
      const body = await json<{ token: string; password: string }>();
      if (!body.token || !pendingResetEmail) return failure('VALIDATION_ERROR', 'Reset token is invalid', 400);
      if (pendingResetEmail === customer.email) seededCustomerPassword = body.password;
      const registered = registeredUsers.get(pendingResetEmail);
      if (registered) registeredUsers.set(pendingResetEmail, { ...registered, password: body.password });
      pendingResetEmail = '';
      return success({});
    }
    if (path === '/auth/me' && method === 'GET') return isAuthenticated(request) ? success(activeUser) : failure('UNAUTHENTICATED', 'Sign in required', 401);
    if (path === '/auth/me' && method === 'PATCH') {
      if (!isAuthenticated(request)) return failure('UNAUTHENTICATED', 'Sign in required', 401);
      const body = await json<{ name?: string; phone?: string }>();
      activeUser = { ...activeUser!, ...body, updatedAt: new Date().toISOString() };
      if (activeUser.email === customer.email) customer = activeUser;
      const registered = registeredUsers.get(activeUser.email);
      if (registered) registeredUsers.set(activeUser.email, { ...registered, user: activeUser });
      return success(activeUser);
    }
    if (path === '/auth/change-password' && method === 'PATCH') {
      if (!isAuthenticated(request)) return failure('UNAUTHENTICATED', 'Sign in required', 401);
      const body = await json<{ currentPassword: string; newPassword: string }>();
      const registered = registeredUsers.get(activeUser!.email);
      const currentPassword = activeUser!.email === customer.email ? seededCustomerPassword : registered?.password;
      if (currentPassword !== body.currentPassword) return failure('VALIDATION_ERROR', 'Current password is incorrect', 400);
      if (activeUser!.email === customer.email) seededCustomerPassword = body.newPassword;
      if (registered) registeredUsers.set(activeUser!.email, { ...registered, password: body.newPassword });
      return success({});
    }
    if (path === '/users/me/addresses') {
      if (!isCustomer(request)) return customerAuthFailure(request);
      if (method === 'GET') return success(addresses);
      if (method === 'POST') {
        const body = await json<Omit<Address, 'id'>>();
        const address: Address = { ...body, id: `address-${Date.now()}` };
        addresses.push(address);
        return success(address);
      }
    }
    const addressMatch = path.match(/^\/users\/me\/addresses\/([^/]+)$/);
    if (addressMatch) {
      if (!isCustomer(request)) return customerAuthFailure(request);
      const index = addresses.findIndex((address) => address.id === decodeURIComponent(addressMatch[1]));
      if (index < 0) return failure('NOT_FOUND', 'Address not found', 404);
      if (method === 'PATCH') {
        addresses[index] = { ...addresses[index], ...await json<Partial<Address>>() };
        return success(addresses[index]);
      }
      if (method === 'DELETE') {
        addresses.splice(index, 1);
        return success({});
      }
    }

    if (path === '/products/filters' && method === 'GET') {
      const active = products.filter((product) => product.isActive);
      const prices = active.map((product) => product.salePrice ?? product.price);
      const meta: ProductFilterMeta = {
        brands: [...new Set(active.map((product) => product.brand))],
        colors: [...new Set(active.flatMap((product) => product.variants.map((variant) => variant.color)))],
        sizes: [...new Set(active.flatMap((product) => product.variants.map((variant) => variant.size)))].sort((a, b) => a - b),
        audiences: [...new Set(active.map((product) => product.audience))],
        types: [...new Set(active.map((product) => product.type))],
        priceRange: { min: Math.min(...prices), max: Math.max(...prices) },
      };
      return success(meta);
    }
    if (path === '/products' && method === 'GET') {
      let result = products.filter((product) => product.isActive);
      const q = url.searchParams.get('q')?.toLowerCase();
      const audience = url.searchParams.get('audience');
      const type = url.searchParams.get('type');
      const brand = url.searchParams.get('brand');
      const color = url.searchParams.get('color');
      const size = Number(url.searchParams.get('size'));
      const minPrice = Number(url.searchParams.get('minPrice'));
      const maxPrice = Number(url.searchParams.get('maxPrice'));
      const hasMinPrice = url.searchParams.has('minPrice');
      const hasMaxPrice = url.searchParams.has('maxPrice');
      result = result.filter((product) =>
        (!q || `${product.name} ${product.brand}`.toLowerCase().includes(q)) &&
        (!audience || product.audience === audience) &&
        (!type || product.type === type) &&
        (!brand || product.brand === brand) &&
        (!color || product.variants.some((variant) => variant.color === color)) &&
        (!size || product.variants.some((variant) => variant.size === size)) &&
        (!hasMinPrice || (product.salePrice ?? product.price) >= minPrice) &&
        (!hasMaxPrice || (product.salePrice ?? product.price) <= maxPrice),
      );
      const sort = url.searchParams.get('sort');
      if (sort === 'price_asc') result.sort((a, b) => (a.salePrice ?? a.price) - (b.salePrice ?? b.price));
      if (sort === 'price_desc') result.sort((a, b) => (b.salePrice ?? b.price) - (a.salePrice ?? a.price));
      if (sort === 'rating') result.sort((a, b) => b.ratingAverage - a.ratingAverage);
      return paged(result, url);
    }
    const reviewsMatch = path.match(/^\/products\/([^/]+)\/reviews$/);
    if (reviewsMatch && method === 'GET') {
      const result = reviews.filter((review) => review.productId === decodeURIComponent(reviewsMatch[1]) && review.status === 'approved');
      return paged(result, url);
    }
    if (reviewsMatch && method === 'POST') {
      if (!isCustomer(request)) return customerAuthFailure(request);
      const body = await json<{ rating: number; comment: string }>();
      const productId = decodeURIComponent(reviewsMatch[1]);
      const eligible = orders.some((order) => order.customerId === activeUser?.id && order.status === 'delivered' && order.items.some((item) => item.productId === productId));
      if (!eligible || reviews.some((review) => review.userId === activeUser?.id && review.productId === productId)) return failure('FORBIDDEN', 'A delivered order is required and only one review is allowed per product', 403);
      const review: Review = { id: `review-${Date.now()}`, productId, userId: activeUser!.id, userName: activeUser!.name, ...body, status: 'pending', createdAt: now };
      reviews.unshift(review);
      return success(review);
    }
    const productMatch = path.match(/^\/products\/([^/]+)$/);
    if (productMatch && method === 'GET') {
      const key = decodeURIComponent(productMatch[1]);
      const product = products.find((candidate) => candidate.id === key || candidate.slug === key);
      return product && product.isActive ? success(product) : failure('NOT_FOUND', 'Product not found', 404);
    }

    if (path === '/cart' && method === 'GET') return isCustomer(request) ? success(buildCart()) : customerAuthFailure(request);
    if (path === '/cart' && method === 'DELETE') {
      if (!isCustomer(request)) return customerAuthFailure(request);
      cartItems = [];
      return success(buildCart());
    }
    if (path === '/cart/items' && method === 'PUT') {
      if (!isCustomer(request)) return customerAuthFailure(request);
      const body = await json<{ productId: string; sku: string; quantity: number }>();
      const product = products.find((candidate) => candidate.id === body.productId && candidate.isActive);
      const variant = product?.variants.find((candidate) => candidate.sku === body.sku);
      if (!product || !variant) return failure('NOT_FOUND', 'Product variant not found', 404);
      if (body.quantity > variant.stock) return failure('OUT_OF_STOCK', 'Requested quantity is not available', 409);
      cartItems = cartItems.filter((item) => item.sku !== body.sku);
      if (body.quantity > 0) cartItems.push({ productId: body.productId, sku: body.sku, name: product.name, image: product.images[0], size: variant.size, color: variant.color, unitPrice: product.salePrice ?? product.price, quantity: body.quantity, stockAvailable: variant.stock });
      return success(buildCart());
    }
    if (path === '/wishlist' && method === 'GET') return isCustomer(request) ? success(wishlistIds) : customerAuthFailure(request);
    const wishlistMatch = path.match(/^\/wishlist\/([^/]+)$/);
    if (wishlistMatch && (method === 'POST' || method === 'DELETE')) {
      if (!isCustomer(request)) return customerAuthFailure(request);
      const id = decodeURIComponent(wishlistMatch[1]);
      wishlistIds = method === 'POST' ? [...new Set([...wishlistIds, id])] : wishlistIds.filter((item) => item !== id);
      return success(wishlistIds);
    }

    if (path === '/delivery-zones' && method === 'GET') return success(zones.filter((zone) => zone.isActive));
    if (path === '/discounts/validate' && method === 'POST') {
      if (!isCustomer(request)) return customerAuthFailure(request);
      const body = await json<{ code: string; subtotal: number }>();
      if (body.code.toUpperCase() !== 'WELCOME10') return failure('VALIDATION_ERROR', 'Discount code is not valid', 400);
      return success({ code: 'WELCOME10', discountAmount: Math.floor(body.subtotal * 0.1) });
    }
    if (path === '/checkout' && method === 'POST') {
      if (!isCustomer(request)) return customerAuthFailure(request);
      const body = await json<Parameters<typeof makeOrder>[0]>();
      const currentCart = buildCart();
      if (currentCart.items.some((item) => item.quantity > item.stockAvailable)) return failure('OUT_OF_STOCK', 'One or more items are no longer in stock', 409);
      const order = makeOrder(body);
      if (!order) return failure('VALIDATION_ERROR', 'Checkout details are incomplete', 400);
      return success({
        order,
        ...(order.paymentMethod === 'paystack' ? { paystack: { authorizationUrl: `${window.location.origin}/checkout/verify?reference=${encodeURIComponent(order.orderNumber)}`, reference: order.orderNumber } } : {}),
      });
    }
    if (path === '/orders' && method === 'GET') return isCustomer(request) ? paged(orders, url) : customerAuthFailure(request);
    const orderMatch = path.match(/^\/orders\/([^/]+)(?:\/(cancel))?$/);
    if (orderMatch) {
      if (!isCustomer(request)) return customerAuthFailure(request);
      const order = orders.find((candidate) => candidate.id === decodeURIComponent(orderMatch[1]));
      if (!order || order.customerId !== activeUser?.id) return failure('NOT_FOUND', 'Order not found', 404);
      if (orderMatch[2] === 'cancel' && method === 'POST') {
        if (order.status !== 'pending_payment' && order.status !== 'paid') return failure('CONFLICT', 'Order cannot be cancelled', 409);
        for (const item of order.items) {
          const variant = products.find((product) => product.id === item.productId)?.variants.find((candidate) => candidate.sku === item.sku);
          if (variant) variant.stock += item.quantity;
        }
        order.status = 'cancelled';
        order.paymentStatus = order.paymentStatus === 'paid' ? 'refunded' : order.paymentStatus;
        order.statusHistory.push({ status: 'cancelled', at: new Date().toISOString() });
      }
      return method === 'GET' || method === 'POST' ? success(order) : undefined;
    }
    const verifyMatch = path.match(/^\/payments\/verify\/([^/]+)$/);
    if (verifyMatch && method === 'GET') {
      if (!isCustomer(request)) return customerAuthFailure(request);
      const order = orders.find((candidate) => candidate.orderNumber === decodeURIComponent(verifyMatch[1]) && candidate.customerId === activeUser?.id);
      if (!order) return failure('NOT_FOUND', 'Order not found', 404);
      if (order.paymentMethod === 'paystack' && order.status === 'pending_payment') {
        order.paymentStatus = 'paid';
        order.status = 'paid';
        order.statusHistory.push({ status: 'paid', at: new Date().toISOString() });
      }
      return success(order);
    }
    if (path === '/returns' && method === 'GET') return isCustomer(request) ? success(returnRequests.filter((item) => item.customerId === activeUser?.id)) : customerAuthFailure(request);
    if (path === '/returns' && method === 'POST') {
      if (!isCustomer(request)) return customerAuthFailure(request);
      const body = await json<{ orderId: string; items: ReturnRequest['items']; reason: string }>();
      const order = orders.find((candidate) => candidate.id === body.orderId && candidate.customerId === activeUser?.id && candidate.status === 'delivered');
      if (!order) return failure('VALIDATION_ERROR', 'Only delivered orders can be returned', 400);
      const request: ReturnRequest = { id: `return-${Date.now()}`, orderId: order.id, orderNumber: order.orderNumber, customerId: order.customerId, ...body, status: 'requested', createdAt: now, updatedAt: now };
      returnRequests = [request, ...returnRequests];
      return success(request);
    }

    return;
  }),
];
