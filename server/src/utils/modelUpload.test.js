import assert from 'node:assert/strict';
import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { uploadsDirectory } from '../config/uploads.js';
import { isAllowedModelUpload, resolveUploadedModelPath, validateGlbFile } from './modelUpload.js';

function makeGlbHeader({ magic = 'glTF', version = 2, length = 12 } = {}) {
  const header = Buffer.alloc(12);
  Buffer.from(magic).copy(header);
  header.writeUInt32LE(version, 4);
  header.writeUInt32LE(length, 8);
  return header;
}

async function validateFixture(name, content, valid) {
  const directory = await mkdtemp(join(tmpdir(), 'shoe-model-upload-'));
  const filePath = join(directory, `${name}.glb`);
  try {
    await writeFile(filePath, content);
    if (valid) {
      await assert.doesNotReject(() => validateGlbFile({ path: filePath }));
      await assert.doesNotReject(() => access(filePath));
      return;
    }

    await assert.rejects(
      () => validateGlbFile({ path: filePath }),
      (error) => error.status === 400 && error.message === 'Uploaded file is not a valid GLB model',
    );
    await assert.rejects(() => access(filePath));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('GLB upload accepts only .glb files with supported content types', () => {
  assert.equal(isAllowedModelUpload({ originalname: 'shoe.glb', mimetype: 'model/gltf-binary' }), true);
  assert.equal(isAllowedModelUpload({ originalname: 'shoe.GLB', mimetype: 'application/octet-stream' }), true);
  assert.equal(isAllowedModelUpload({ originalname: 'shoe.gltf', mimetype: 'model/gltf-binary' }), false);
  assert.equal(isAllowedModelUpload({ originalname: 'shoe.glb', mimetype: 'model/gltf+json' }), false);
});

test('uploaded model path resolution accepts only UUID files inside the models directory', () => {
  const filename = '123e4567-e89b-12d3-a456-426614174000.glb';
  assert.equal(
    resolveUploadedModelPath(`/uploads/models/${filename}`),
    resolve(uploadsDirectory, 'models', filename),
  );
  assert.equal(resolveUploadedModelPath('https://models.example/shoe.glb'), undefined);
  assert.equal(resolveUploadedModelPath(`/uploads/models/../../${filename}`), undefined);
});

test('GLB validation accepts a version 2 header with a matching declared length', async () => {
  await validateFixture('valid', makeGlbHeader(), true);
});

test('GLB validation rejects and removes a file with the wrong magic', async () => {
  await validateFixture('wrong-magic', makeGlbHeader({ magic: 'nope' }), false);
});

test('GLB validation rejects and removes a file with the wrong version', async () => {
  await validateFixture('wrong-version', makeGlbHeader({ version: 1 }), false);
});

test('GLB validation rejects and removes a file with the wrong declared length', async () => {
  await validateFixture('wrong-length', makeGlbHeader({ length: 13 }), false);
});
