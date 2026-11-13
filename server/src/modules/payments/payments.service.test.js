import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Order, Transaction } from '../../models/index.js';
import ApiError from '../../utils/ApiError.js';
import { confirmSuccessfulPayment } from './payments.service.js';

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
