import { api } from '../shared/api/client';
import type {
  Address,
  AuthPayload,
  Cart,
  CheckoutRequest,
  CheckoutResponse,
  DeliveryZone,
  DiscountCheck,
  Order,
  PageMeta,
  Product,
  ProductFilterMeta,
  Review,
  ReturnRequest,
  ShippingAddress,
  User,
} from '../shared/types';

export interface ApiResult<T> {
  data: T;
  meta?: PageMeta;
}

export interface ProductQuery {
  q?: string;
  audience?: string;
  type?: string;
  brand?: string;
  size?: number;
  color?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'rating';
  page?: number;
  limit?: number;
}

async function data<T>(request: Promise<ApiResult<T>>): Promise<T> {
  return (await request).data;
}

export const customerApi = {
  products: (params: ProductQuery = {}) =>
    api.get<Product[]>('/products', { params }),
  productFilters: () => data(api.get<ProductFilterMeta>('/products/filters')),
  product: (idOrSlug: string) =>
    data(api.get<Product>(`/products/${encodeURIComponent(idOrSlug)}`)),
  reviews: (productId: string, page = 1, limit = 10) =>
    api.get<Review[]>(`/products/${encodeURIComponent(productId)}/reviews`, {
      params: { page, limit },
    }),
  createReview: (productId: string, body: Pick<Review, 'rating' | 'comment'>) =>
    data(api.post<Review>(`/products/${encodeURIComponent(productId)}/reviews`, body)),
  cart: () => data(api.get<Cart>('/cart')),
  setCartItem: (productId: string, sku: string, quantity: number) =>
    data(api.put<Cart>('/cart/items', { productId, sku, quantity })),
  clearCart: () => data(api.delete<Cart>('/cart')),
  wishlist: () => data(api.get<string[]>('/wishlist')),
  toggleWishlist: (productId: string, saved: boolean) =>
    data(
      saved
        ? api.delete<string[]>(`/wishlist/${encodeURIComponent(productId)}`)
        : api.post<string[]>(`/wishlist/${encodeURIComponent(productId)}`),
    ),
  deliveryZones: () => data(api.get<DeliveryZone[]>('/delivery-zones')),
  validateDiscount: (code: string, subtotal: number) =>
    data(api.post<DiscountCheck>('/discounts/validate', { code, subtotal })),
  checkout: (body: CheckoutRequest) =>
    data(api.post<CheckoutResponse>('/checkout', body)),
  orders: (page = 1, limit = 20) =>
    api.get<Order[]>('/orders', { params: { page, limit } }),
  order: (id: string) => data(api.get<Order>(`/orders/${encodeURIComponent(id)}`)),
  cancelOrder: (id: string) =>
    data(api.post<Order>(`/orders/${encodeURIComponent(id)}/cancel`)),
  verifyPayment: (reference: string) =>
    data(api.get<Order>(`/payments/verify/${encodeURIComponent(reference)}`)),
  verifyGuestPayment: (reference: string, token: string) =>
    data(api.post<Order>(`/payments/guest-verify/${encodeURIComponent(reference)}`, { token })),
  createReturn: (body: {
    orderId: string;
    items: { sku: string; quantity: number }[];
    reason: string;
  }) => data(api.post<ReturnRequest>('/returns', body)),
  returns: () => data(api.get<ReturnRequest[]>('/returns')),
  profile: () => data(api.get<User>('/auth/me')),
  updateProfile: (body: { name?: string; phone?: string }) =>
    data(api.patch<User>('/auth/me', body)),
  uploadAvatar: (file: File) => {
    const body = new FormData();
    body.append('image', file);
    return data(api.post<User>('/auth/me/avatar', body));
  },
  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    data(api.patch<Record<string, never>>('/auth/change-password', body)),
  addresses: () => data(api.get<Address[]>('/users/me/addresses')),
  addAddress: (body: Omit<Address, 'id'>) =>
    data(api.post<Address>('/users/me/addresses', body)),
  updateAddress: (id: string, body: Partial<Omit<Address, 'id'>>) =>
    data(api.patch<Address>(`/users/me/addresses/${encodeURIComponent(id)}`, body)),
  deleteAddress: (id: string) =>
    data(api.delete<Record<string, never>>(`/users/me/addresses/${encodeURIComponent(id)}`)),
  register: (body: { name: string; email: string; password: string; phone?: string }) =>
    data(api.post<AuthPayload>('/auth/register', body)),
  forgotPassword: (email: string) =>
    data(api.post<Record<string, never>>('/auth/forgot-password', { email })),
  resetPassword: (token: string, password: string) =>
    data(api.post<Record<string, never>>('/auth/reset-password', { token, password })),
};

export type NewShippingAddress = ShippingAddress;
