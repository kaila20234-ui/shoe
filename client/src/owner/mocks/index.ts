import { http, HttpResponse } from 'msw';
import type { AuditLog, Order, Transaction } from '../../shared/types';

const customerNames = ['Amina Okafor', 'Chinedu Bello', 'Tolu Adeyemi', 'Mariam Yusuf', 'David Eze', 'Zainab Musa'];
const transactionStatuses: Transaction['status'][] = ['success', 'success', 'success', 'pending', 'failed', 'refunded'];

const transactions: Transaction[] = Array.from({ length: 60 }, (_, index): Transaction => {
  const date = new Date();
  date.setDate(date.getDate() - ((index * 37) % 90));
  date.setHours(9 + (index % 9), (index * 7) % 60, 0, 0);
  const sequence = String(10000 + index);
  const orderNumber = `SS-${date.toISOString().slice(0, 10).replace(/-/g, '')}-${sequence.slice(-5)}`;
  return {
    id: `txn-${String(index + 1).padStart(3, '0')}`,
    reference: index % 3 === 0 ? `POD-${orderNumber}` : `PSK-${date.getTime()}-${sequence}`,
    orderId: `order-${String(index + 1).padStart(3, '0')}`,
    orderNumber,
    customerId: `customer-${(index % 6) + 1}`,
    customerName: customerNames[index % customerNames.length],
    amount: 1250000 + ((index * 73900) % 8750000),
    method: index % 3 === 0 ? 'pay_on_delivery' : 'paystack',
    status: transactionStatuses[index % transactionStatuses.length],
    createdAt: date.toISOString(),
    updatedAt: date.toISOString(),
  };
}).sort((left, right) => right.createdAt.localeCompare(left.createdAt));

function orderFor(transaction: Transaction): Order {
  const refunded = transaction.status === 'refunded';
  const paid = transaction.status === 'success' || refunded;
  const at = transaction.createdAt;
  const statusHistory: Order['statusHistory'] = [{ status: 'pending_payment', at }];
  if (paid) statusHistory.push({ status: 'paid', at }, { status: 'delivered', at });
  if (refunded) statusHistory.push({ status: 'refunded', at });
  return {
    id: transaction.orderId,
    orderNumber: transaction.orderNumber,
    customerId: transaction.customerId,
    customerName: transaction.customerName,
    customerEmail: `${transaction.customerName.toLowerCase().replace(/ /g, '.')}@example.test`,
    items: [{
      productId: 'product-air-runner',
      sku: 'SH-RUN-BLK-42',
      name: 'Air Runner Classic',
      image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=640',
      size: 42,
      color: 'Black',
      unitPrice: transaction.amount - 250000,
      quantity: 1,
    }],
    subtotal: transaction.amount - 250000,
    discountAmount: 0,
    deliveryFee: 250000,
    total: transaction.amount,
    shippingAddress: {
      recipient: transaction.customerName,
      phone: '+234 803 000 0000',
      street: '14 Allen Avenue',
      city: 'Ikeja',
      state: 'Lagos',
    },
    deliveryZoneId: 'zone-lagos',
    paymentMethod: transaction.method,
    paymentStatus: refunded ? 'refunded' : paid ? 'paid' : transaction.status === 'failed' ? 'failed' : 'unpaid',
    status: refunded ? 'refunded' : paid ? 'delivered' : 'pending_payment',
    statusHistory,
    createdAt: at,
    updatedAt: at,
  };
}

function matches(transaction: Transaction, params: URLSearchParams): boolean {
  const from = params.get('from');
  const to = params.get('to');
  const status = params.get('status');
  const method = params.get('method');
  const query = params.get('q')?.toLowerCase().trim();
  const day = transaction.createdAt.slice(0, 10);
  if (from && day < from) return false;
  if (to && day > to) return false;
  if (status && transaction.status !== status) return false;
  if (method && transaction.method !== method) return false;
  if (query && ![transaction.reference, transaction.orderNumber, transaction.customerName]
    .some((value) => value.toLowerCase().includes(query))) return false;
  return true;
}

function paginate<T>(records: T[], params: URLSearchParams) {
  const page = Math.max(1, Number(params.get('page')) || 1);
  const limit = Math.min(100, Math.max(1, Number(params.get('limit')) || 20));
  const offset = (page - 1) * limit;
  return {
    data: records.slice(offset, offset + limit),
    meta: { page, limit, total: records.length, totalPages: Math.ceil(records.length / limit) },
  };
}

function makeSeries(fromValue: string, toValue: string, period: 'daily' | 'weekly' | 'monthly') {
  const cursor = new Date(`${fromValue}T00:00:00`);
  const end = new Date(`${toValue}T00:00:00`);
  const dates: string[] = [];
  while (cursor <= end && dates.length < 366) {
    dates.push(cursor.toISOString().slice(0, 10));
    if (period === 'daily') cursor.setDate(cursor.getDate() + 1);
    else if (period === 'weekly') cursor.setDate(cursor.getDate() + 7);
    else cursor.setMonth(cursor.getMonth() + 1);
  }
  return dates.map((date) => {
    const records = transactions.filter((item) => item.createdAt.slice(0, 10) === date && item.status === 'success');
    return {
      date,
      revenue: records.reduce((sum, item) => sum + item.amount, 0),
      orders: records.length,
    };
  });
}

const auditLogs: AuditLog[] = [
  { id: 'audit-1', actorId: 'admin-1', actorName: 'Ada Admin', actorRole: 'admin', action: 'order.status_change', entity: 'order', entityId: 'order-001', createdAt: new Date().toISOString() },
  { id: 'audit-2', actorId: 'admin-2', actorName: 'Sam Admin', actorRole: 'admin', action: 'product.update', entity: 'product', entityId: 'product-air-runner', createdAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'audit-3', actorId: 'admin-1', actorName: 'Ada Admin', actorRole: 'admin', action: 'discount.create', entity: 'discount', entityId: 'discount-welcome', createdAt: new Date(Date.now() - 3 * 86400000).toISOString() },
  { id: 'audit-4', actorId: 'admin-2', actorName: 'Sam Admin', actorRole: 'admin', action: 'review.moderate', entity: 'review', entityId: 'review-008', createdAt: new Date(Date.now() - 8 * 86400000).toISOString() },
  { id: 'audit-5', actorId: 'admin-1', actorName: 'Ada Admin', actorRole: 'admin', action: 'return.update', entity: 'return', entityId: 'return-002', createdAt: new Date(Date.now() - 12 * 86400000).toISOString() },
];

const topProducts = [
  { productId: 'product-air-runner', name: 'Air Runner Classic', unitsSold: 42, revenue: 42000000 },
  { productId: 'product-city-walk', name: 'City Walk Leather', unitsSold: 31, revenue: 38750000 },
  { productId: 'product-lagos-slide', name: 'Lagos Comfort Slide', unitsSold: 28, revenue: 15400000 },
  { productId: 'product-trail-pro', name: 'Trail Pro', unitsSold: 17, revenue: 29750000 },
  { productId: 'product-mini-step', name: 'Mini Step Kids', unitsSold: 16, revenue: 9600000 },
];

export const handlers = [
  http.get('/api/owner/transactions/export', ({ request }) => {
    const url = new URL(request.url);
    const records = transactions.filter((transaction) => matches(transaction, url.searchParams));
    const rows = [
      ['Date', 'Reference', 'OrderNumber', 'Customer', 'Method', 'Status', 'Amount(NGN)'],
      ...records.map((item) => [
        item.createdAt,
        item.reference,
        item.orderNumber,
        item.customerName,
        item.method,
        item.status,
        (item.amount / 100).toFixed(2),
      ]),
    ];
    const csv = rows.map((row) => row.map((field) => `"${field.replace(/"/g, '""')}"`).join(',')).join('\r\n');
    return new HttpResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="shoe-store-transactions.csv"',
      },
    });
  }),

  http.get('/api/owner/transactions', ({ request }) => {
    const url = new URL(request.url);
    const records = transactions.filter((transaction) => matches(transaction, url.searchParams));
    return HttpResponse.json({ success: true, ...paginate(records, url.searchParams) });
  }),

  http.get('/api/owner/transactions/:id', ({ params }) => {
    const transaction = transactions.find((item) => item.id === params.id);
    if (!transaction) {
      return HttpResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Transaction not found.' } },
        { status: 404 },
      );
    }
    return HttpResponse.json({ success: true, data: { transaction, order: orderFor(transaction) } });
  }),

  http.get('/api/owner/reports/summary', ({ request }) => {
    const url = new URL(request.url);
    const periodValue = url.searchParams.get('period');
    const period: 'daily' | 'weekly' | 'monthly' =
      periodValue === 'weekly' || periodValue === 'monthly' ? periodValue : 'daily';
    const to = url.searchParams.get('to') ?? new Date().toISOString().slice(0, 10);
    const fromDate = new Date(`${to}T00:00:00`);
    fromDate.setDate(fromDate.getDate() - (period === 'daily' ? 6 : period === 'weekly' ? 49 : 330));
    const from = url.searchParams.get('from') ?? fromDate.toISOString().slice(0, 10);
    const params = new URLSearchParams({ from, to });
    const records = transactions.filter((item) => matches(item, params));
    const successful = records.filter((item) => item.status === 'success');
    const refunded = records.filter((item) => item.status === 'refunded');
    const revenue = successful.reduce((sum, item) => sum + item.amount, 0);
    return HttpResponse.json({
      success: true,
      data: {
        period,
        from,
        to,
        totals: {
          revenue,
          orders: successful.length,
          refunds: refunded.reduce((sum, item) => sum + item.amount, 0),
          averageOrderValue: successful.length ? Math.round(revenue / successful.length) : 0,
        },
        series: makeSeries(from, to, period),
      },
    });
  }),

  http.get('/api/owner/reports/top-products', ({ request }) => {
    const url = new URL(request.url);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 5));
    return HttpResponse.json({ success: true, data: topProducts.slice(0, limit) });
  }),

  http.get('/api/audit-logs', ({ request }) => {
    const url = new URL(request.url);
    const actorId = url.searchParams.get('actorId');
    const entity = url.searchParams.get('entity');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const records = auditLogs.filter((log) => {
      const day = log.createdAt.slice(0, 10);
      return (!actorId || log.actorId === actorId)
        && (!entity || log.entity === entity)
        && (!from || day >= from)
        && (!to || day <= to);
    });
    return HttpResponse.json({ success: true, ...paginate(records, url.searchParams) });
  }),
];
