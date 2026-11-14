import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { Cart, DeliveryZone, Discount, Order, Product, Transaction, User } from '../../models/index.js';
import { createCheckout, failPendingPayment } from './checkout.service.js';

const checkoutInput = {
  shippingAddress: {
    recipient: 'Customer',
    phone: '+2348000000000',
    street: '1 Test Street',
    city: 'Lagos',
    state: 'Lagos',
  },
  deliveryZoneId: 'zone-1',
  paymentMethod: 'pay_on_delivery',
};

function setupCheckoutMocks(t, { createOrder } = {}) {
  const cart = {
    items: [{ productId: 'product-1', sku: 'SHOE-42', quantity: 2 }],
    async save() {},
  };
  const product = {
    id: 'product-1',
    name: 'Test shoe',
    images: ['/shoe.png'],
    price: 5000,
    variants: [{ sku: 'SHOE-42', size: 42, color: 'Black', stock: 5 }],
  };
  const stockUpdates = [];
  t.mock.method(Cart, 'findOne', async () => cart);
  t.mock.method(DeliveryZone, 'findOne', async () => ({ states: ['Lagos'], fee: 500 }));
  t.mock.method(User, 'findById', async () => ({ id: 'customer-1', name: 'Customer', email: 'customer@example.com' }));
  t.mock.method(Product, 'find', async () => [product]);
  t.mock.method(Product, 'updateOne', async (_filter, update) => {
    stockUpdates.push(update.$inc['variants.$.stock']);
    return { modifiedCount: 1 };
  });
  t.mock.method(Order, 'exists', async () => false);
  t.mock.method(Order, 'create', createOrder ?? (async (order) => ({ ...order, id: 'order-1' })));
  t.mock.method(Transaction, 'create', async () => ({ id: 'transaction-1' }));
  t.mock.method(Transaction, 'deleteOne', async () => ({ deletedCount: 1 }));
  t.mock.method(console, 'info', () => {});
  return { cart, stockUpdates };
}

test('createCheckout reserves stock and returns an order', async (t) => {
  const { cart, stockUpdates } = setupCheckoutMocks(t);

  const result = await createCheckout('customer-1', checkoutInput);

  assert.equal(result.order.status, 'pending_payment');
  assert.deepEqual(stockUpdates, [-2]);
  assert.deepEqual(cart.items, []);
});

test('createCheckout rolls back reserved stock when order creation fails', async (t) => {
  const { stockUpdates } = setupCheckoutMocks(t, {
    createOrder: async () => { throw new Error('order persistence failed'); },
  });
  t.mock.method(Order, 'deleteOne', async () => ({ deletedCount: 0 }));

  await assert.rejects(
    createCheckout('customer-1', checkoutInput),
    /order persistence failed/,
  );

  assert.deepEqual(stockUpdates, [-2, 2]);
});

test('createCheckout accepts a guest cart and contact details', async (t) => {
  let orderInput;
  const { stockUpdates } = setupCheckoutMocks(t, {
    createOrder: async (order) => {
      orderInput = order;
      return { ...order, id: 'guest-order-1' };
    },
  });

  const result = await createCheckout(undefined, {
    ...checkoutInput,
    guestDetails: { name: 'Guest Customer', email: 'guest@example.com' },
    items: [{ productId: 'product-1', sku: 'SHOE-42', quantity: 1 }],
  });

  assert.equal(result.order.customerName, 'Guest Customer');
  assert.equal(result.order.customerEmail, 'guest@example.com');
  assert.equal(orderInput.customerId, undefined);
  assert.deepEqual(stockUpdates, [-1]);
});

test('guest Paystack checkout returns a token but stores only its hash', async (t) => {
  const previousSecret = process.env.PAYSTACK_SECRET_KEY;
  const previousEnvironment = process.env.NODE_ENV;
  process.env.PAYSTACK_SECRET_KEY = 'sk_test_local_simulated';
  process.env.NODE_ENV = 'test';
  t.after(() => {
    if (previousSecret === undefined) delete process.env.PAYSTACK_SECRET_KEY;
    else process.env.PAYSTACK_SECRET_KEY = previousSecret;
    if (previousEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment;
  });

  let orderInput;
  setupCheckoutMocks(t, {
    createOrder: async (order) => {
      orderInput = order;
      return { ...order, id: 'guest-order-2' };
    },
  });

  const result = await createCheckout(undefined, {
    ...checkoutInput,
    paymentMethod: 'paystack',
    guestDetails: { name: 'Guest Customer', email: 'guest@example.com' },
    items: [{ productId: 'product-1', sku: 'SHOE-42', quantity: 1 }],
  });

  assert.equal(result.guestAccessToken?.length, 64);
  assert.equal(orderInput.guestAccessTokenHash, createHash('sha256').update(result.guestAccessToken).digest('hex'));
  assert.equal(orderInput.guestAccessTokenExpiresAt instanceof Date, true);
});

test('failPendingPayment restores stock and releases a discount only once', async (t) => {
  let transitionCount = 0;
  const order = {
    _id: 'order-1',
    orderNumber: 'SS-20261113-00001',
    discountCode: 'SAVE10',
    items: [{ productId: 'product-1', sku: 'SHOE-42', quantity: 2 }],
  };
  t.mock.method(Order, 'findOneAndUpdate', async () => {
    transitionCount += 1;
    return transitionCount === 1 ? order : null;
  });
  t.mock.method(Order, 'updateOne', async (_filter, update) => {
    assert.equal(update.$set.discountUseReleased, true);
    return { modifiedCount: 1 };
  });
  t.mock.method(Product, 'updateOne', async () => ({ modifiedCount: 1 }));
  const discountUpdate = t.mock.method(Discount, 'updateOne', async (filter, update) => {
    assert.equal(filter.code, 'SAVE10');
    assert.equal(update.$inc.usedCount, -1);
    return { modifiedCount: 1 };
  });
  const transactionUpdate = t.mock.method(Transaction, 'updateOne', async () => ({ modifiedCount: 1 }));

  await failPendingPayment(order.orderNumber);
  await failPendingPayment(order.orderNumber);

  assert.equal(Product.updateOne.mock.callCount(), 1);
  assert.equal(discountUpdate.mock.callCount(), 1);
  assert.equal(transactionUpdate.mock.callCount(), 1);
});
