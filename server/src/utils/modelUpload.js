import { randomUUID } from 'node:crypto';
import { mkdir, open, unlink } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import multer from 'multer';
import ApiError from './ApiError.js';
import { uploadsDirectory } from '../config/uploads.js';

const modelDirectory = resolve(uploadsDirectory, 'models');
const acceptedContentTypes = new Set(['model/gltf-binary', 'application/octet-stream']);
const glbMagicBytes = Buffer.from('glTF');

export function isAllowedModelUpload(file) {
  return extname(file.originalname).toLowerCase() === '.glb'
    && acceptedContentTypes.has(file.mimetype);
}

const upload = multer({
  storage: multer.diskStorage({
    destination(_req, _file, callback) {
      mkdir(modelDirectory, { recursive: true }).then(
        () => callback(null, modelDirectory),
        callback,
      );
    },
    filename(_req, _file, callback) {
      callback(null, `${randomUUID()}.glb`);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, callback) {
    if (!isAllowedModelUpload(file)) {
      callback(new ApiError(400, 'VALIDATION_ERROR', 'Model must be a .glb file with a supported content type'));
      return;
    }
    callback(null, true);
  },
});

export function uploadGlb(req, res, next) {
  upload.single('model')(req, res, (error) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return next(new ApiError(400, 'VALIDATION_ERROR', 'GLB model must be 20 MB or smaller'));
    }
    return next(error);
  });
}

export async function validateGlbFile(file) {
  const handle = await open(file.path, 'r');
  let valid = false;
  try {
    const header = Buffer.alloc(glbMagicBytes.length);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    valid = bytesRead === glbMagicBytes.length && header.equals(glbMagicBytes);
  } finally {
    await handle.close();
  }

  if (!valid) {
    await unlink(file.path);
    throw new ApiError(400, 'VALIDATION_ERROR', 'Uploaded file is not a valid GLB model');
  }
}
