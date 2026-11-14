import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { after, before, test } from 'node:test';
import { unlink } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import app from './app.js';
import { uploadsDirectory } from './config/uploads.js';
import { AuditLog, User } from './models/index.js';

const webhookSecret = 'express-webhook-integration-test-secret';
const jwtSecret = 'express-upload-integration-test-secret';
let server;
let origin;
let previousSecret;
let previousJwtSecret;

before(async () => {
  previousSecret = process.env.PAYSTACK_SECRET_KEY;
  previousJwtSecret = process.env.JWT_SECRET;
  process.env.PAYSTACK_SECRET_KEY = webhookSecret;
  process.env.JWT_SECRET = jwtSecret;
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  origin = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server?.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
  if (previousSecret === undefined) delete process.env.PAYSTACK_SECRET_KEY;
  else process.env.PAYSTACK_SECRET_KEY = previousSecret;
  if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = previousJwtSecret;
});

test('Express Paystack webhook accepts a valid signature over the raw body', async () => {
  const body = Buffer.from(JSON.stringify({
    event: 'integration.test',
    data: { reference: 'webhook-integration-test', amount: 1 },
  }));
  const signature = createHmac('sha512', webhookSecret).update(body).digest('hex');
  const response = await fetch(`${origin}/api/payments/paystack/webhook`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-paystack-signature': signature,
    },
    body,
  });

  assert.equal(response.status, 200);
});

test('Express Paystack webhook rejects a bad signature', async () => {
  const body = Buffer.from(JSON.stringify({
    event: 'integration.test',
    data: { reference: 'webhook-integration-test', amount: 1 },
  }));
  const response = await fetch(`${origin}/api/payments/paystack/webhook`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-paystack-signature': 'bad-signature',
    },
    body,
  });

  assert.equal(response.status, 401);
});

function configureUser(t, role) {
  t.mock.method(User, 'findById', async (id) => ({
    id: String(id),
    name: 'Upload test user',
    role,
    isActive: true,
    toJSON() {
      return { id: this.id, name: this.name, role: this.role, isActive: this.isActive };
    },
  }));
}

function uploadToken(subject) {
  return jwt.sign({ sub: subject }, jwtSecret, { algorithm: 'HS256' });
}

function uploadForm(fileName, contentType, content) {
  const form = new FormData();
  form.append('model', new Blob([content], { type: contentType }), fileName);
  return form;
}

function makeValidGlb() {
  const json = Buffer.from('{"asset":{"version":"2.0"}}');
  const paddedJson = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
  const header = Buffer.alloc(12);
  Buffer.from('glTF').copy(header);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + paddedJson.length, 8);
  const chunkHeader = Buffer.alloc(8);
  chunkHeader.writeUInt32LE(paddedJson.length, 0);
  chunkHeader.write('JSON', 4, 4, 'ascii');
  return Buffer.concat([header, chunkHeader, paddedJson]);
}

test('admin can upload and retrieve a valid GLB model', async (t) => {
  configureUser(t, 'admin');
  t.mock.method(AuditLog, 'create', async () => ({ id: 'audit-upload-test' }));
  const content = makeValidGlb();
  const response = await fetch(`${origin}/api/admin/uploads/model`, {
    method: 'POST',
    headers: { authorization: `Bearer ${uploadToken('upload-admin')}` },
    body: uploadForm('shoe.glb', 'model/gltf-binary', content),
  });
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.match(result.data.url, /^\/uploads\/models\/[0-9a-f-]{36}\.glb$/i);
  const filePath = resolve(uploadsDirectory, 'models', basename(result.data.url));
  try {
    const storedResponse = await fetch(`${origin}${result.data.url}`);
    assert.equal(storedResponse.status, 200);
    assert.deepEqual(Buffer.from(await storedResponse.arrayBuffer()), content);
  } finally {
    await unlink(filePath);
  }
});

test('GLB upload rejects an unsupported content type', async (t) => {
  configureUser(t, 'admin');
  const response = await fetch(`${origin}/api/admin/uploads/model`, {
    method: 'POST',
    headers: { authorization: `Bearer ${uploadToken('upload-admin')}` },
    body: uploadForm('shoe.glb', 'text/plain', Buffer.from('glTF')),
  });

  assert.equal(response.status, 400);
});

test('GLB upload rejects files larger than 20 MB', async (t) => {
  configureUser(t, 'admin');
  const oversizedContent = Buffer.alloc(20 * 1024 * 1024 + 1);
  const response = await fetch(`${origin}/api/admin/uploads/model`, {
    method: 'POST',
    headers: { authorization: `Bearer ${uploadToken('upload-admin')}` },
    body: uploadForm('large.glb', 'application/octet-stream', oversizedContent),
  });

  assert.equal(response.status, 400);
  const result = await response.json();
  assert.equal(result.error.message, 'GLB model must be 20 MB or smaller');
});

test('non-admin users cannot upload GLB models', async (t) => {
  configureUser(t, 'customer');
  const response = await fetch(`${origin}/api/admin/uploads/model`, {
    method: 'POST',
    headers: { authorization: `Bearer ${uploadToken('upload-customer')}` },
    body: uploadForm('shoe.glb', 'model/gltf-binary', makeValidGlb()),
  });

  assert.equal(response.status, 403);
});
