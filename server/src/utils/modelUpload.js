import { randomUUID } from 'node:crypto';
import { mkdir, open, unlink } from 'node:fs/promises';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';
import multer from 'multer';
import ApiError from './ApiError.js';
import { uploadsDirectory } from '../config/uploads.js';

const modelDirectory = resolve(uploadsDirectory, 'models');
const acceptedContentTypes = new Set(['model/gltf-binary', 'application/octet-stream']);
const glbMagicBytes = Buffer.from('glTF');
const uploadedModelPathPattern = /^\/uploads\/models\/([0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\.glb)$/i;

export function resolveUploadedModelPath(modelUrl) {
  const match = typeof modelUrl === 'string' ? uploadedModelPathPattern.exec(modelUrl) : null;
  if (!match) return undefined;

  const filePath = resolve(modelDirectory, match[1]);
  const relativePath = relative(modelDirectory, filePath);
  if (!relativePath || relativePath === '..' || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
    return undefined;
  }
  return filePath;
}

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
  const filePath = file.path;
  try {
    const handle = await open(filePath, 'r');
    let valid;
    try {
      const header = Buffer.alloc(12);
      const { bytesRead } = await handle.read(header, 0, header.length, 0);
      const { size } = await handle.stat();
      valid = bytesRead === header.length
        && header.subarray(0, 4).equals(glbMagicBytes)
        && header.readUInt32LE(4) === 2
        && header.readUInt32LE(8) === size;
    } finally {
      await handle.close();
    }

    if (!valid) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Uploaded file is not a valid GLB model');
    }
  } catch (error) {
    try {
      await unlink(filePath);
    } catch (cleanupError) {
      if (cleanupError.code !== 'ENOENT') {
        throw new AggregateError([error, cleanupError], 'GLB validation failed and uploaded file could not be removed');
      }
    }
    throw error;
  }
}
