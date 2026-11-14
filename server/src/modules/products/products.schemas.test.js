import assert from 'node:assert/strict';
import { test } from 'node:test';
import { productInputSchema, productPatchSchema } from './products.schemas.js';

const product = {
  name: 'Test shoe',
  description: 'A sample shoe',
  brand: 'Test',
  audience: 'men',
  type: 'sneakers',
  price: 12500,
  images: ['https://example.com/shoe.png'],
  variants: [{ sku: 'TEST-42', size: 42, color: 'Black', stock: 2 }],
};

test('product schemas accept an optional model URL and allow clearing it', () => {
  const parsed = productInputSchema.parse({ ...product, modelUrl: 'https://example.com/shoe.glb' });
  assert.equal(parsed.modelUrl, 'https://example.com/shoe.glb');
  assert.equal(productPatchSchema.parse({ modelUrl: null }).modelUrl, null);
  assert.equal(productPatchSchema.safeParse({ modelUrl: 'not-a-url' }).success, false);
});
