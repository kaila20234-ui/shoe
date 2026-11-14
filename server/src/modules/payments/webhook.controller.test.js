import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { Order, Transaction } from '../../models/index.js';
import ApiError from '../../utils/ApiError.js';
import { paystackWebhook } from './webhook.controller.js';

const reference = 'SS-20261113-10203';
const payment = { reference, amount: 12500, currency: 'NGN' };
const pendingOrder = {
  orderNumber: reference,
  total: payment.amount,
  paymentMethod: 'paystack',
  paymentStatus: 'unpaid',
  status: 'pending_payment',
  customerEmail: 'customer@example.com',
};

function configureSecret(t) {
  const previous = process.env.PAYSTACK_SECRET_KEY;
  process.env.PAYSTACK_SECRET_KEY = 'webhook-test-secret';
  t.after(() => {
    if (previous === undefined) delete process.env.PAYSTACK_SECRET_KEY;
    else process.env.PAYSTACK_SECRET_KEY = previous;
  });
}

function webhookRequest(event, signatureOverride) {
  const body = Buffer.from(JSON.stringify(event));
  const signature = signatureOverride ?? createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(body)
    .digest('hex');
  const req = { body, get: (name) => name === 'x-paystack-signature' ? signature : undefined };
  const res = {
    statusCode: undefined,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
  return { req, res };
}

async function deliver(event, signature) {
  const { req, res } = webhookRequest(event, signature);
  await paystackWebhook(req, res);
  return res;
}

function successEvent(overrides = {}) {
  return {
    event: 'charge.success',
    data: { ...payment, ...overrides },
  };
}

test('webhook accepts a valid signature and repeated delivery is idempotent', async (t) => {
  configureSecret(t);
  let paidOrder;
  const paid = { ...pendingOrder, status: 'paid', paymentStatus: 'paid' };
  t.mock.method(Order, 'findOne', async () => paidOrder ?? pendingOrder);
  const orderUpdate = t.mock.method(Order, 'findOneAndUpdate', async () => {
    paidOrder = paid;
    return paid;
  });
  const transactionUpdate = t.mock.method(Transaction, 'updateOne', async () => ({ modifiedCount: 1 }));
  t.mock.method(console, 'info', () => {});

  const first = await deliver(successEvent());
  const repeated = await deliver(successEvent());

  assert.equal(first.statusCode, 200);
  assert.equal(repeated.statusCode, 200);
  assert.equal(orderUpdate.mock.callCount(), 1);
  assert.equal(transactionUpdate.mock.callCount(), 2);
});

test('webhook rejects an invalid signature', async (t) => {
  configureSecret(t);
  const orderLookup = t.mock.method(Order, 'findOne', async () => pendingOrder);
  const { req, res } = webhookRequest(successEvent(), 'invalid-signature');

  await assert.rejects(paystackWebhook(req, res), (error) => error instanceof ApiError && error.status === 401);
  assert.equal(orderLookup.mock.callCount(), 0);
});

test('webhook logs and rejects an amount mismatch', async (t) => {
  configureSecret(t);
  t.mock.method(Order, 'findOne', async () => pendingOrder);
  const orderUpdate = t.mock.method(Order, 'findOneAndUpdate', async () => {
    throw new Error('Mismatched payments must not update records');
  });
  const errorLog = t.mock.method(console, 'error', () => {});
  const { req, res } = webhookRequest(successEvent({ amount: payment.amount + 1 }));

  await assert.rejects(paystackWebhook(req, res), (error) => error instanceof ApiError && error.status === 400);

  assert.equal(orderUpdate.mock.callCount(), 0);
  assert.equal(errorLog.mock.calls[0].arguments[0], 'Paystack charge.success could not be reconciled.');
  assert.equal(errorLog.mock.calls[0].arguments[1].reference, reference);
  assert.equal(errorLog.mock.calls[0].arguments[1].event, 'charge.success');
});

test('webhook flags a late charge for a failed order for manual review', async (t) => {
  configureSecret(t);
  const failedOrder = { ...pendingOrder, paymentStatus: 'failed' };
  t.mock.method(Order, 'findOne', async () => failedOrder);
  t.mock.method(Order, 'findOneAndUpdate', async () => null);
  const transactionUpdate = t.mock.method(Transaction, 'updateOne', async (_filter, update) => {
    assert.equal(update.$set.status, 'needs_review');
    return { matchedCount: 1, modifiedCount: 1 };
  });
  const errorLog = t.mock.method(console, 'error', () => {});
  const { req, res } = webhookRequest(successEvent());

  await assert.rejects(paystackWebhook(req, res), (error) => error instanceof ApiError && error.status === 409);

  assert.equal(transactionUpdate.mock.callCount(), 1);
  assert.equal(errorLog.mock.calls[0].arguments[1].reference, reference);
  assert.equal(errorLog.mock.calls[0].arguments[1].reason, 'Paystack payment was confirmed, but the order status could not be updated');
});

test('webhook logs an unknown order', async (t) => {
  configureSecret(t);
  t.mock.method(Order, 'findOne', async () => null);
  const errorLog = t.mock.method(console, 'error', () => {});
  const { req, res } = webhookRequest(successEvent());

  await assert.rejects(paystackWebhook(req, res), (error) => error instanceof ApiError && error.status === 404);

  assert.equal(errorLog.mock.calls[0].arguments[1].reference, reference);
  assert.equal(errorLog.mock.calls[0].arguments[1].event, 'charge.success');
});
