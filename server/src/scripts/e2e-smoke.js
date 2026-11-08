import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { loadEnv } from '../config/env.js';

loadEnv();

const apiUrl = `http://127.0.0.1:${process.env.PORT || 5000}/api`;

async function request(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    method,
    signal: AbortSignal.timeout(15000),
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  return { response, payload };
}

async function api(path, options) {
  const result = await request(path, options);
  assert.equal(result.response.ok, true, `${options?.method || 'GET'} ${path}: ${JSON.stringify(result.payload)}`);
  assert.equal(result.payload?.success, true, `${options?.method || 'GET'} ${path} did not return the API envelope`);
  return result.payload.data;
}

const email = `e2e-${Date.now()}@shoestore.test`;
const registered = await api('/auth/register', {
  method: 'POST',
  body: { name: 'E2E Customer', email, password: 'TestPassw0rd!123', phone: '+2348000000000' },
});
assert.equal(registered.user.role, 'customer');
const customerToken = registered.token;
console.info('Registered customer');

const productResponse = await api('/products?page=1&limit=5');
const product = productResponse.find((item) => item.variants.some((variant) => variant.stock > 0));
assert.ok(product, 'Catalog has no in-stock products');
await api('/products/filters');
await api(`/products/${encodeURIComponent(product.slug)}`);
await api(`/products/${product.id}/reviews?page=1&limit=10`);
const variant = product.variants.find((item) => item.stock > 0);
await api('/cart/items', {
  method: 'PUT',
  token: customerToken,
  body: { productId: product.id, sku: variant.sku, quantity: 1 },
});
console.info('Browsed catalog and added an item to cart');
const cart = await api('/cart', { token: customerToken });
const discountCheck = await api('/discounts/validate', {
  method: 'POST',
  token: customerToken,
  body: { code: 'WELCOME10', subtotal: 1 },
});
assert.equal(discountCheck.discountAmount, Math.floor(cart.subtotal / 10), 'Discount validation trusted the client subtotal');

const zones = await api('/delivery-zones');
const zone = zones.find((item) => item.states.includes('Lagos'));
assert.ok(zone, 'No active Lagos delivery zone exists');
const checkout = await api('/checkout', {
  method: 'POST',
  token: customerToken,
  body: {
    shippingAddress: {
      recipient: 'E2E Customer',
      phone: '+2348000000000',
      street: '1 Test Street',
      city: 'Lagos',
      state: 'Lagos',
    },
    deliveryZoneId: zone.id,
    discountCode: 'WELCOME10',
    paymentMethod: 'paystack',
  },
});
assert.ok(checkout.paystack?.authorizationUrl, 'Paystack checkout did not return authorizationUrl');
assert.equal(checkout.order.status, 'pending_payment');
assert.equal(checkout.order.discountAmount, discountCheck.discountAmount);
console.info(`Created Paystack order ${checkout.order.orderNumber}`);

const rawBody = Buffer.from(JSON.stringify({
  event: 'charge.success',
  data: {
    reference: checkout.order.orderNumber,
    amount: checkout.order.total,
    currency: 'NGN',
    status: 'success',
  },
}));
const signature = createHmac('sha512', process.env.PAYSTACK_SECRET_KEY).update(rawBody).digest('hex');
const webhookResponse = await fetch(`${apiUrl}/payments/paystack/webhook`, {
  method: 'POST',
  signal: AbortSignal.timeout(15000),
  headers: { 'Content-Type': 'application/json', 'x-paystack-signature': signature },
  body: rawBody,
});
assert.equal(webhookResponse.status, 200, `Signed webhook failed: ${await webhookResponse.text()}`);
const paidOrder = await api(`/orders/${checkout.order.id}`, { token: customerToken });
assert.equal(paidOrder.status, 'paid');
assert.equal(paidOrder.paymentStatus, 'paid');
await api('/orders?page=1&limit=20', { token: customerToken });
console.info('Verified signed webhook settlement');

const admin = await api('/auth/login', {
  method: 'POST',
  body: { email: 'admin@shoestore.test', password: 'Passw0rd!123' },
});
for (const path of [
  '/admin/dashboard/summary',
  '/admin/products?page=1&limit=100',
  '/admin/orders?page=1&limit=100',
  '/admin/customers?page=1&limit=100',
  '/admin/inventory/low-stock?threshold=5',
  '/admin/delivery-zones',
  '/admin/discounts',
  '/admin/reviews?page=1&limit=100',
  '/admin/returns?page=1&limit=100',
  '/audit-logs?page=1&limit=100',
]) {
  await api(path, { token: admin.token });
}
for (const status of ['packed', 'shipped', 'delivered']) {
  const updated = await api(`/admin/orders/${checkout.order.id}/status`, {
    method: 'PATCH',
    token: admin.token,
    body: { status },
  });
  assert.equal(updated.status, status);
}
console.info('Admin moved the order through packed, shipped, and delivered');

const owner = await api('/auth/login', {
  method: 'POST',
  body: { email: 'owner@shoestore.test', password: 'Passw0rd!123' },
});
const transactions = await api('/owner/transactions?page=1&limit=20', { token: owner.token });
const transaction = transactions.find((item) => item.orderId === checkout.order.id);
assert.ok(transaction, 'Owner cannot see the settled order transaction');
assert.equal(transaction.status, 'success');
await api(`/owner/transactions/${transaction.id}`, { token: owner.token });
await api('/owner/reports/summary?period=daily', { token: owner.token });
await api('/owner/reports/top-products?limit=5', { token: owner.token });
await api('/audit-logs?page=1&limit=20', { token: owner.token });
const csv = await request('/owner/transactions/export?format=csv', { token: owner.token });
assert.equal(csv.response.ok, true, 'Owner CSV export failed');
assert.match(csv.response.headers.get('content-disposition') || '', /attachment/i);
assert.ok(String(csv.payload).includes(checkout.order.orderNumber), 'CSV export omitted the order');
console.info('Owner viewed the transaction and exported CSV');

const ownerWriteChecks = [
  ['POST', '/owner/transactions', {}],
  ['PUT', `/owner/transactions/${transaction.id}`, {}],
  ['PATCH', `/owner/transactions/${transaction.id}`, {}],
  ['DELETE', `/owner/transactions/${transaction.id}`],
  ['POST', '/audit-logs', {}],
  ['PATCH', '/auth/me', { name: 'Owner Mutation Attempt' }],
  ['PATCH', '/auth/change-password', { currentPassword: 'Passw0rd!123', newPassword: 'NewPassw0rd!123' }],
  ['PUT', '/cart/items', {}],
  ['DELETE', '/cart'],
  ['POST', `/wishlist/${product.id}`, {}],
  ['DELETE', `/wishlist/${product.id}`],
  ['POST', '/discounts/validate', {}],
  ['POST', '/checkout', {}],
  ['POST', `/orders/${checkout.order.id}/cancel`, {}],
  ['POST', `/products/${product.id}/reviews`, {}],
  ['POST', '/returns', {}],
  ['POST', '/users/me/addresses', { label: 'Home' }],
  ['PATCH', '/users/me/addresses/000000000000000000000000', {}],
  ['DELETE', '/users/me/addresses/000000000000000000000000'],
  ['POST', '/admin/products', {}],
  ['PUT', `/admin/products/${product.id}`, {}],
  ['DELETE', `/admin/products/${product.id}`],
  ['POST', '/admin/uploads/image', {}],
  ['PATCH', `/admin/orders/${checkout.order.id}/status`, { status: 'cancelled' }],
];
for (const [method, path, body] of ownerWriteChecks) {
  const result = await request(path, { method, token: owner.token, ...(body !== undefined ? { body } : {}) });
  assert.equal(result.response.status, 403, `Owner ${method} ${path} returned ${result.response.status}, expected 403`);
}

console.info(`E2E passed for ${email}, ${checkout.order.orderNumber}; ${ownerWriteChecks.length} owner write checks all returned 403.`);
