import type {
  AuditLog,
  DeliveryZone,
  Discount,
  LowStockItem,
  Order,
  Product,
  ReturnRequest,
  Review,
} from '../../shared/types';

export type CustomerRow = { id: string; name: string; email: string; status: 'active' | 'blocked'; totalSpent: number };

export const dashboardStats = [
  { label: 'Today orders', value: '82', change: '+12%' },
  { label: 'Today revenue', value: '₦1,240,000', change: '+8.2%' },
  { label: 'Pending orders', value: '14', change: '-3%' },
  { label: 'Low stock', value: '7', change: '+2' }
];

export const recentOrders: Order[] = [
  {
    id: 'ord-1',
    orderNumber: 'SS-20261108-00001',
    customerId: 'c-1',
    customerName: 'Ada Okafor',
    customerEmail: 'ada@example.com',
    items: [{
      productId: 'p-1',
      sku: 'NK-AM-01-WHT-42',
      name: 'Nike Air Max',
      image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff',
      size: 42,
      color: 'White',
      unitPrice: 175000,
      quantity: 1
    }],
    subtotal: 175000,
    discountAmount: 25000,
    deliveryFee: 5000,
    total: 155000,
    shippingAddress: { recipient: 'Ada Okafor', phone: '08000000000', street: '12 Allen Avenue', city: 'Ikeja', state: 'Lagos', landmark: 'near church' },
    deliveryZoneId: 'zone-1',
    paymentMethod: 'paystack',
    paymentStatus: 'paid',
    status: 'paid',
    statusHistory: [],
    createdAt: '2026-11-08T10:00:00.000Z',
    updatedAt: '2026-11-08T10:00:00.000Z'
  }
];

export const lowStockItems: LowStockItem[] = [
  { productId: 'p-1', name: 'Nike Air Max', sku: 'NK-AM-01-WHT-42', size: 42, color: 'White', stock: 2 },
  { productId: 'p-2', name: 'Adidas Ultraboost', sku: 'AD-UB-02-BLK-39', size: 39, color: 'Black', stock: 4 }
];

export const productRows: Product[] = [
  {
    id: 'p-1',
    name: 'Nike Air Max',
    slug: 'nike-air-max',
    description: 'Everyday comfort',
    brand: 'Nike',
    audience: 'men',
    type: 'sneakers',
    price: 185000,
    salePrice: 165000,
    images: ['https://images.unsplash.com/photo-1542291026-7eec264c27ff'],
    variants: [
      { sku: 'NK-AM-01-WHT-42', size: 42, color: 'White', stock: 2 },
      { sku: 'NK-AM-01-WHT-40', size: 40, color: 'White', stock: 7 }
    ],
    isActive: true,
    ratingAverage: 4.5,
    ratingCount: 18,
    createdAt: '2026-11-08T09:00:00.000Z',
    updatedAt: '2026-11-08T09:00:00.000Z'
  }
];

export const customerRows: CustomerRow[] = [
  { id: 'c-1', name: 'Ada Okafor', email: 'ada@example.com', status: 'active', totalSpent: 855000 },
  { id: 'c-2', name: 'Basil Adebayo', email: 'basil@example.com', status: 'blocked', totalSpent: 250000 }
];

export const discountRows: Discount[] = [
  { id: 'd-1', code: 'WELCOME10', type: 'percentage', value: 10, minSubtotal: 50000, usedCount: 12, isActive: true },
  { id: 'd-2', code: 'FREESHIP', type: 'fixed', value: 150000, minSubtotal: 250000, usedCount: 5, isActive: true }
];

export const deliveryRows: DeliveryZone[] = [
  { id: 'z-1', name: 'Lagos Mainland', states: ['Lagos'], fee: 15000, estimatedDays: '2-3 days', isActive: true },
  { id: 'z-2', name: 'South-West', states: ['Ogun', 'Oyo'], fee: 22000, estimatedDays: '3-5 days', isActive: true }
];

export const reviewRows: Review[] = [
  { id: 'r-1', productId: 'p-1', userId: 'u-1', userName: 'Mariam', rating: 5, comment: 'Great quality and fit.', status: 'pending', createdAt: '2026-11-08T09:00:00.000Z' }
];

export const returnRows: ReturnRequest[] = [
  { id: 'rr-1', orderId: 'ord-1', orderNumber: 'SS-20261108-00001', customerId: 'c-1', items: [{ sku: 'NK-AM-01-WHT-42', quantity: 1 }], reason: 'Size too large', status: 'requested', createdAt: '2026-11-08T09:00:00.000Z', updatedAt: '2026-11-08T09:00:00.000Z' }
];

export const auditRows: AuditLog[] = [
  { id: 'a-1', actorId: 'admin-1', actorName: 'Admin User', actorRole: 'admin', action: 'order.status_change', entity: 'order', entityId: 'ord-1', meta: { status: 'paid' }, createdAt: '2026-11-08T09:00:00.000Z' }
];

export const formatPrice = (amount: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount / 100);
