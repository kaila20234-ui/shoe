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

test('product schemas accept HTTPS GLB and GLTF URLs with query strings', () => {
  const glbUrl = 'https://example.com/shoe.glb?signature=abc';
  const gltfUrl = 'https://example.com/shoe.GLTF?download=1';
  assert.equal(productInputSchema.parse({ ...product, modelUrl: glbUrl }).modelUrl, glbUrl);
  assert.equal(productInputSchema.parse({ ...product, modelUrl: gltfUrl }).modelUrl, gltfUrl);
});

test('product schemas reject insecure URLs and URLs without a supported file extension', () => {
  for (const modelUrl of [
    'http://example.com/shoe.glb',
    'https://example.com/shoe.obj',
    'https://example.com/shoe?file=shoe.glb',
    'not-a-url',
  ]) {
    assert.equal(productInputSchema.safeParse({ ...product, modelUrl }).success, false, modelUrl);
  }
});

test('product schemas allow clearing an optional model URL', () => {
  assert.equal(productPatchSchema.parse({ modelUrl: null }).modelUrl, null);
  assert.equal(productInputSchema.safeParse(product).success, true);
});

test('product schemas accept uploaded GLB model paths', () => {
  const modelUrl = '/uploads/models/123e4567-e89b-12d3-a456-426614174000.glb';
  assert.equal(productInputSchema.parse({ ...product, modelUrl }).modelUrl, modelUrl);
});
