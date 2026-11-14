import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { access, mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { uploadsDirectory } from '../../config/uploads.js';
import { AuditLog, Product } from '../../models/index.js';
import { deleteProduct, updateProduct } from './admin.controller.js';

const modelDirectory = resolve(uploadsDirectory, 'models');

function setupProductMocks(t, modelUrl, save = async () => {}) {
  const product = { id: 'product-1', modelUrl, price: 10000, save };
  t.mock.method(Product, 'findById', async () => ({ modelUrl }));
  t.mock.method(Product, 'findOne', async () => product);
  t.mock.method(AuditLog, 'create', async () => ({}));
  return product;
}

function makeRequest(body = {}) {
  return {
    params: { id: 'product-1' },
    body,
    user: { id: 'admin-1', name: 'Admin', role: 'admin' },
  };
}

function makeResponse() {
  return {
    statusCode: undefined,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

async function createUploadedModel() {
  const filename = `${randomUUID()}.glb`;
  const filePath = resolve(modelDirectory, filename);
  await mkdir(modelDirectory, { recursive: true });
  await writeFile(filePath, Buffer.from('glTF'));
  return { filePath, modelUrl: `/uploads/models/${filename}` };
}

async function assertFileRemoved(filePath) {
  await assert.rejects(access(filePath), { code: 'ENOENT' });
}

test('updateProduct deletes the previous uploaded model when replacing it', async (t) => {
  const { filePath, modelUrl } = await createUploadedModel();
  const product = setupProductMocks(t, modelUrl);
  const response = makeResponse();
  try {
    await updateProduct(makeRequest({ modelUrl: 'https://models.example/new.glb' }), response);
    assert.equal(response.statusCode, 200);
    assert.equal(product.modelUrl, 'https://models.example/new.glb');
    await assertFileRemoved(filePath);
  } finally {
    await rm(filePath, { force: true });
  }
});

test('updateProduct deletes the previous uploaded model when clearing it', async (t) => {
  const { filePath, modelUrl } = await createUploadedModel();
  const product = setupProductMocks(t, modelUrl);
  const response = makeResponse();
  try {
    await updateProduct(makeRequest({ modelUrl: null }), response);
    assert.equal(response.statusCode, 200);
    assert.equal(product.modelUrl, undefined);
    await assertFileRemoved(filePath);
  } finally {
    await rm(filePath, { force: true });
  }
});

test('deleteProduct removes the previous uploaded model', async (t) => {
  const { filePath, modelUrl } = await createUploadedModel();
  const product = setupProductMocks(t, modelUrl);
  const response = makeResponse();
  try {
    await deleteProduct(makeRequest(), response);
    assert.equal(response.statusCode, 200);
    assert.equal(product.isActive, false);
    await assertFileRemoved(filePath);
  } finally {
    await rm(filePath, { force: true });
  }
});

test('failed product updates preserve the existing uploaded model', async (t) => {
  const { filePath, modelUrl } = await createUploadedModel();
  setupProductMocks(t, modelUrl, async () => {
    throw new Error('product update failed');
  });
  try {
    await assert.rejects(
      updateProduct(makeRequest({ modelUrl: null }), makeResponse()),
      /product update failed/,
    );
    await assert.doesNotReject(() => access(filePath));
  } finally {
    await rm(filePath, { force: true });
  }
});

test('model cleanup failures are logged without failing the product update', async (t) => {
  const modelUrl = `/uploads/models/${randomUUID()}.glb`;
  setupProductMocks(t, modelUrl);
  const errorLog = t.mock.method(console, 'error', () => {});
  const response = makeResponse();

  await updateProduct(makeRequest({ modelUrl: null }), response);

  assert.equal(response.statusCode, 200);
  assert.equal(errorLog.mock.callCount(), 1);
  assert.equal(errorLog.mock.calls[0].arguments[0], 'Unable to delete orphaned product model file.');
});

test('external model URLs are not treated as uploaded files', async (t) => {
  setupProductMocks(t, 'https://models.example/shoe.glb');
  const errorLog = t.mock.method(console, 'error', () => {});
  const response = makeResponse();

  await updateProduct(makeRequest({ modelUrl: null }), response);

  assert.equal(response.statusCode, 200);
  assert.equal(errorLog.mock.callCount(), 0);
});
