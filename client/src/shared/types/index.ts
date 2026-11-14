/**
 * SHOE STORE — SHARED TYPES (authoritative data model)
 * Repo location: client/src/shared/types/index.ts
 * Rules:
 *  - Money is ALWAYS an integer in kobo (NGN x 100). Never floats.
 *  - Dates are ISO 8601 strings in JSON.
 *  - Every document exposes `id` (string). Never `_id` in API responses.
 *  - Only the contract owner (the human) edits this file.
 */

// ---------- Primitives ----------
export type Role = 'customer' | 'admin' | 'owner';
export type Audience = 'men' | 'women' | 'kids';
export type ShoeType = 'sneakers' | 'formal' | 'sandals' | 'boots' | 'sports';

export type OrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'packed'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export type PaymentMethod = 'paystack' | 'pay_on_delivery';
export type PaymentStatus = 'unpaid' | 'paid' | 'failed' | 'refunded';
export type TransactionStatus = 'pending' | 'success' | 'failed' | 'refunded' | 'needs_review';
export type ReviewStatus = 'pending' | 'approved' | 'rejected';
export type ReturnStatus = 'requested' | 'approved' | 'rejected' | 'refunded';
export type DiscountType = 'percentage' | 'fixed';

// ---------- API envelope ----------
export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
export interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
  meta?: PageMeta;
}
export type ErrorCode =
  | 'VALIDATION_ERROR'   // 400 (details = field errors)
  | 'UNAUTHENTICATED'    // 401
  | 'FORBIDDEN'          // 403
  | 'NOT_FOUND'          // 404
  | 'CONFLICT'           // 409
  | 'OUT_OF_STOCK'       // 409
  | 'PAYMENT_FAILED'     // 402
  | 'INTERNAL';          // 500
export interface ApiFailure {
  success: false;
  error: { code: ErrorCode; message: string; details?: Record<string, string> };
}

// ---------- Users ----------
export interface Address {
  id: string;
  label: string;          // e.g. "Home", "Office"
  recipient: string;
  phone: string;
  street: string;
  city: string;
  state: string;          // Nigerian state name, matches DeliveryZone.states
  landmark?: string;
  isDefault: boolean;
}
export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  role: Role;
  isActive: boolean;      // false = blocked, cannot log in
  addresses: Address[];
  wishlist: string[];     // product ids
  createdAt: string;
  updatedAt: string;
}
export interface AuthPayload {
  token: string;
  user: User;
}

// ---------- Products ----------
export interface ProductVariant {
  sku: string;            // unique across all products, e.g. "NK-AF1-WHT-42"
  size: number;           // EU size
  color: string;
  stock: number;          // >= 0
}
export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  brand: string;
  audience: Audience;
  type: ShoeType;
  price: number;          // kobo
  salePrice?: number;     // kobo, must be < price when present
  images: string[];       // URLs (Cloudinary), first is the cover
  modelUrl?: string;
  variants: ProductVariant[];
  isActive: boolean;      // false = hidden from storefront (soft delete)
  ratingAverage: number;  // 0-5, one decimal
  ratingCount: number;
  createdAt: string;
  updatedAt: string;
}
export interface ProductFilterMeta {
  brands: string[];
  colors: string[];
  sizes: number[];
  audiences: Audience[];
  types: ShoeType[];
  priceRange: { min: number; max: number };
}
export interface LowStockItem {
  productId: string;
  name: string;
  sku: string;
  size: number;
  color: string;
  stock: number;
}

// ---------- Cart ----------
export interface CartItem {
  productId: string;
  sku: string;
  name: string;
  image: string;
  size: number;
  color: string;
  unitPrice: number;      // effective price (salePrice ?? price), kobo
  quantity: number;
  stockAvailable: number;
}
export interface Cart {
  items: CartItem[];
  subtotal: number;       // kobo
}

// ---------- Delivery & discounts ----------
export interface DeliveryZone {
  id: string;
  name: string;           // e.g. "Lagos Mainland"
  states: string[];
  fee: number;            // kobo
  estimatedDays: string;  // e.g. "2-3 days"
  isActive: boolean;
}
export interface Discount {
  id: string;
  code: string;           // uppercase, unique
  type: DiscountType;
  value: number;          // percentage: 1-100 | fixed: kobo
  minSubtotal: number;    // kobo, 0 = none
  maxUses?: number;
  usedCount: number;
  expiresAt?: string;
  isActive: boolean;
}
export interface DiscountCheck {
  code: string;
  discountAmount: number; // kobo
}

// ---------- Orders & payments ----------
export interface OrderItem {   // snapshot at purchase time
  productId: string;
  sku: string;
  name: string;
  image: string;
  size: number;
  color: string;
  unitPrice: number;
  quantity: number;
}
export interface ShippingAddress {
  recipient: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  landmark?: string;
}
export interface StatusHistoryEntry {
  status: OrderStatus;
  note?: string;
  at: string;
  byUserId?: string;
}
export interface Order {
  id: string;
  orderNumber: string;    // "SS-YYYYMMDD-XXXXX"
  customerId?: string;
  customerName: string;
  customerEmail: string;
  items: OrderItem[];
  subtotal: number;
  discountCode?: string;
  discountAmount: number;
  deliveryFee: number;
  total: number;          // subtotal - discountAmount + deliveryFee
  shippingAddress: ShippingAddress;
  deliveryZoneId: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  statusHistory: StatusHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}
export interface CheckoutRequest {
  addressId?: string;             // saved address, OR:
  shippingAddress?: ShippingAddress;
  guestDetails?: { name: string; email: string };
  items?: { productId: string; sku: string; quantity: number }[];
  deliveryZoneId: string;
  paymentMethod: PaymentMethod;
  discountCode?: string;
}
export interface CheckoutResponse {
  order: Order;
  guestAccessToken?: string;
  paystack?: { authorizationUrl: string; reference: string }; // only for paymentMethod 'paystack'
}
export interface Transaction {
  id: string;
  reference: string;      // Paystack reference, or "POD-<orderNumber>" for pay on delivery
  orderId: string;
  orderNumber: string;
  customerId?: string;
  customerName: string;
  amount: number;         // kobo
  method: PaymentMethod;
  status: TransactionStatus;
  createdAt: string;
  updatedAt: string;
}

// ---------- Reviews & returns ----------
export interface Review {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number;         // 1-5
  comment: string;
  status: ReviewStatus;   // storefront only shows 'approved'
  createdAt: string;
}
export interface ReturnRequest {
  id: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  items: { sku: string; quantity: number }[];
  reason: string;
  status: ReturnStatus;
  adminNote?: string;
  createdAt: string;
  updatedAt: string;
}

// ---------- Admin / owner reporting ----------
export interface AuditLog {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: Role;
  action: string;         // e.g. "product.update", "order.status_change"
  entity: string;         // e.g. "product", "order"
  entityId: string;
  meta?: Record<string, unknown>;
  createdAt: string;
}
export interface DashboardSummary {
  todayOrders: number;
  todayRevenue: number;   // kobo
  pendingOrders: number;  // status 'paid' or 'pending_payment'
  lowStockCount: number;
  recentOrders: Order[];  // latest 5
  lowStockItems: LowStockItem[];
}
export interface ReportSummary {
  period: 'daily' | 'weekly' | 'monthly';
  from: string;
  to: string;
  totals: { revenue: number; orders: number; refunds: number; averageOrderValue: number };
  series: { date: string; revenue: number; orders: number }[];
}
export interface TopProduct {
  productId: string;
  name: string;
  unitsSold: number;
  revenue: number;
}
