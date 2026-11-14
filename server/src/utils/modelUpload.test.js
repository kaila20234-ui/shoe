import assert from 'node:assert/strict';
import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { isAllowedModelUpload, validateGlbFile } from './modelUpload.js';

test('GLB upload accepts only .glb files with supported content types', () => {
  assert.equal(isAllowedModelUpload({ originalname: 'shoe.glb', mimetype: 'model/gltf-binary' }), true);
  assert.equal(isAllowedModelUpload({ originalname: 'shoe.GLB', mimetype: 'application/octet-stream' }), true);
  assert.equal(isAllowedModelUpload({ originalname: 'shoe.gltf', mimetype: 'model/gltf-binary' }), false);
  assert.equal(isAllowedModelUpload({ originalname: 'shoe.glb', mimetype: 'model/gltf+json' }), false);
});

test('GLB validation checks magic bytes and removes invalid uploads', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'shoe-model-upload-'));
  const validPath = join(directory, 'valid.glb');
  const invalidPath = join(directory, 'invalid.glb');
  try {
    await writeFile(validPath, Buffer.from('glTF'));
    await writeFile(invalidPath, Buffer.from('nope'));
    await assert.doesNotReject(() => validateGlbFile({ path: validPath }));
    await assert.rejects(() => validateGlbFile({ path: invalidPath }), (error) => error.status === 400);
    await assert.rejects(() => access(invalidPath));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
