import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Discount } from '../../models/index.js';
import ApiError from '../../utils/ApiError.js';
import { getApplicableDiscount } from './discounts.service.js';

test('percentage discounts are capped at subtotal', async (t) => {
  t.mock.method(Discount, 'findOne', async () => ({
    type: 'percentage',
    value: 100,
    minSubtotal: 0,
    usedCount: 0,
    isActive: true,
  }));

  const result = await getApplicableDiscount('save-all', 1250);

  assert.equal(result.discountAmount, 1250);
});

test('percentage discounts over 100 are rejected', async (t) => {
  t.mock.method(Discount, 'findOne', async () => ({
    type: 'percentage',
    value: 101,
    minSubtotal: 0,
    usedCount: 0,
    isActive: true,
  }));

  await assert.rejects(
    getApplicableDiscount('invalid', 1250),
    (error) => error instanceof ApiError && error.status === 400,
  );
});
