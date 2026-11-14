import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Order } from '../../models/index.js';
import ApiError from '../../utils/ApiError.js';
import { cancelCustomerOrder, changeOrderStatus } from './orders.service.js';

const paidOrder = {
  _id: 'order-1',
  id: 'order-1',
  customerId: 'customer-1',
  orderNumber: 'SS-20261113-10204',
  status: 'paid',
  paymentStatus: 'paid',
  paymentMethod: 'paystack',
  items: [],
};

function mockFailingRefund(t, onRequest) {
  const previousSecret = process.env.PAYSTACK_SECRET_KEY;
  process.env.PAYSTACK_SECRET_KEY = 'refund-test-secret';
  t.after(() => {
    if (previousSecret === undefined) delete process.env.PAYSTACK_SECRET_KEY;
    else process.env.PAYSTACK_SECRET_KEY = previousSecret;
  });
  t.mock.method(globalThis, 'fetch', async (...args) => {
    onRequest(...args);
    throw new Error('simulated network failure');
  });
  t.mock.method(console, 'error', () => {});
}

function mockOrderTransitions(t) {
  let currentStatus = 'paid';
  const transition = t.mock.method(Order, 'findOneAndUpdate', async (_filter, update) => {
    currentStatus = update.$set.status;
    return { ...paidOrder, status: currentStatus, paymentStatus: 'paid' };
  });
  return { transition, getCurrentStatus: () => currentStatus };
}

test('customer cancellation changes status before refund and restores it on failure', async (t) => {
  t.mock.method(Order, 'findOne', async () => paidOrder);
  const { transition, getCurrentStatus } = mockOrderTransitions(t);
  mockFailingRefund(t, () => assert.equal(getCurrentStatus(), 'cancelled'));

  await assert.rejects(
    cancelCustomerOrder('customer-1', 'order-1'),
    (error) => error instanceof ApiError && error.status === 503,
  );

  assert.equal(transition.mock.callCount(), 2);
  assert.equal(getCurrentStatus(), 'paid');
});

test('admin status change applies status before refund and restores it on failure', async (t) => {
  t.mock.method(Order, 'findById', async () => paidOrder);
  const { transition, getCurrentStatus } = mockOrderTransitions(t);
  mockFailingRefund(t, () => assert.equal(getCurrentStatus(), 'cancelled'));

  await assert.rejects(
    changeOrderStatus({ user: { id: 'admin-1' } }, 'order-1', 'cancelled'),
    (error) => error instanceof ApiError && error.status === 503,
  );

  assert.equal(transition.mock.callCount(), 2);
  assert.equal(getCurrentStatus(), 'paid');
});
