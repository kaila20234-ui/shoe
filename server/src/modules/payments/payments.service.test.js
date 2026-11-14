import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { Order, Transaction } from '../../models/index.js';
import ApiError from '../../utils/ApiError.js';
import { confirmSuccessfulPayment, verifyForCustomer, verifyForGuest } from './payments.service.js';

const payment = { reference: 'SS-20261112-07429', amount: 12500, currency: 'NGN' };
const pendingOrder = {
  orderNumber: payment.reference,
  total: payment.amount,
  paymentMethod: 'paystack',
  paymentStatus: 'unpaid',
  status: 'pending_payment',
  customerEmail: 'customer@example.com',
};

test('verified Paystack payment marks the order and transaction paid', async (t) => {
  const updatedOrder = { ...pendingOrder, paymentStatus: 'paid', status: 'paid' };
  t.mock.method(Order, 'findOne', async () => pendingOrder);
  t.mock.method(Order, 'findOneAndUpdate', async (filter, update) => {
    assert.equal(filter.status, 'pending_payment');
    assert.equal(update.$set.paymentStatus, 'paid');
    assert.equal(update.$set.status, 'paid');
    assert.equal(update.$push.statusHistory.status, 'paid');
    return updatedOrder;
  });
  const transactionUpdate = t.mock.method(Transaction, 'updateOne', async () => ({ modifiedCount: 1 }));
  t.mock.method(console, 'info', () => {});

  const result = await confirmSuccessfulPayment(payment);

  assert.equal(result.paymentStatus, 'paid');
  assert.equal(result.status, 'paid');
  assert.equal(transactionUpdate.mock.callCount(), 1);
});

test('duplicate payment confirmation does not append another paid transition', async (t) => {
  const paidOrder = { ...pendingOrder, paymentStatus: 'paid', status: 'paid' };
  t.mock.method(Order, 'findOne', async () => paidOrder);
  const orderUpdate = t.mock.method(Order, 'findOneAndUpdate', async () => {
    throw new Error('Already-paid orders must not be updated again');
  });
  const transactionUpdate = t.mock.method(Transaction, 'updateOne', async () => ({ modifiedCount: 1 }));

  const result = await confirmSuccessfulPayment(payment);

  assert.equal(result, paidOrder);
  assert.equal(orderUpdate.mock.callCount(), 0);
  assert.equal(transactionUpdate.mock.callCount(), 1);
});

test('payment confirmation rejects an amount mismatch without changing records', async (t) => {
  t.mock.method(Order, 'findOne', async () => pendingOrder);
  const orderUpdate = t.mock.method(Order, 'findOneAndUpdate', async () => {
    throw new Error('Mismatched payments must not update orders');
  });

  await assert.rejects(
    confirmSuccessfulPayment({ ...payment, amount: payment.amount + 1 }),
    (error) => error instanceof ApiError && error.status === 400,
  );
  assert.equal(orderUpdate.mock.callCount(), 0);
});

test('customer verification marks a simulated successful payment as paid', async (t) => {
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

  const updatedOrder = { ...pendingOrder, customerId: 'customer-1', paymentStatus: 'paid', status: 'paid' };
  t.mock.method(Order, 'findOne', async () => ({ ...pendingOrder, customerId: 'customer-1' }));
  t.mock.method(Order, 'findOneAndUpdate', async (_filter, update) => {
    assert.equal(update.$set.paymentStatus, 'paid');
    return updatedOrder;
  });
  const transactionUpdate = t.mock.method(Transaction, 'updateOne', async () => ({ modifiedCount: 1 }));
  t.mock.method(console, 'info', () => {});

  const result = await verifyForCustomer('customer-1', payment.reference);

  assert.equal(result.paymentStatus, 'paid');
  assert.equal(transactionUpdate.mock.callCount(), 1);
});

test('guest verification requires its checkout token and confirms payment', async (t) => {
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

  const token = 'a'.repeat(64);
  const guestOrder = {
    ...pendingOrder,
    guestAccessTokenHash: createHash('sha256').update(token).digest('hex'),
    guestAccessTokenExpiresAt: new Date(Date.now() + 60_000),
  };
  t.mock.method(Order, 'findOne', () => ({
    select: async () => guestOrder,
    then: (resolve, reject) => Promise.resolve(guestOrder).then(resolve, reject),
  }));
  const updatedOrder = { ...guestOrder, status: 'paid', paymentStatus: 'paid' };
  t.mock.method(Order, 'findOneAndUpdate', async () => updatedOrder);
  const transactionUpdate = t.mock.method(Transaction, 'updateOne', async () => ({ modifiedCount: 1 }));

  const result = await verifyForGuest(payment.reference, token);

  assert.equal(result.paymentStatus, 'paid');
  assert.equal(transactionUpdate.mock.callCount(), 1);
});

test('guest verification rejects an incorrect token without checking payment', async (t) => {
  const guestOrder = {
    ...pendingOrder,
    guestAccessTokenHash: createHash('sha256').update('b'.repeat(64)).digest('hex'),
    guestAccessTokenExpiresAt: new Date(Date.now() + 60_000),
  };
  t.mock.method(Order, 'findOne', () => ({ select: async () => guestOrder }));
  const orderUpdate = t.mock.method(Order, 'findOneAndUpdate', async () => {
    throw new Error('Invalid guest tokens must not update orders');
  });

  await assert.rejects(
    verifyForGuest(payment.reference, 'a'.repeat(64)),
    (error) => error instanceof ApiError && error.status === 404,
  );
  assert.equal(orderUpdate.mock.callCount(), 0);
});

test('late successful payment flags a failed-order transaction for review', async (t) => {
  const failedOrder = {
    ...pendingOrder,
    paymentStatus: 'failed',
    status: 'pending_payment',
  };
  t.mock.method(Order, 'findOne', async () => failedOrder);
  t.mock.method(Order, 'findOneAndUpdate', async () => null);
  const transactionUpdate = t.mock.method(Transaction, 'updateOne', async (_filter, update) => {
    assert.equal(update.$set.status, 'needs_review');
    return { matchedCount: 1, modifiedCount: 1 };
  });

  await assert.rejects(confirmSuccessfulPayment(payment), (error) => error.status === 409);

  assert.equal(transactionUpdate.mock.callCount(), 1);
});
