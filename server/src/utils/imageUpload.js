import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import multer from 'multer';
import ApiError from './ApiError.js';
import { uploadsDirectory } from '../config/uploads.js';

const extensionsByMimeType = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const uploadDirectories = {
  products: resolve(uploadsDirectory, 'products'),
  avatars: resolve(uploadsDirectory, 'avatars'),
};

export function createImageUpload(folder) {
  const destination = uploadDirectories[folder];
  if (!destination) throw new Error(`Unsupported image upload folder: ${folder}`);

  return multer({
    storage: multer.diskStorage({
      destination(_req, _file, callback) {
        mkdir(destination, { recursive: true }).then(
          () => callback(null, destination),
          callback,
        );
      },
      filename(_req, file, callback) {
        callback(null, `${randomUUID()}.${extensionsByMimeType[file.mimetype]}`);
      },
    }),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter(_req, file, callback) {
      if (!extensionsByMimeType[file.mimetype]) {
        callback(new ApiError(400, 'VALIDATION_ERROR', 'Image must be JPG, PNG, or WebP'));
        return;
      }
      callback(null, true);
    },
  });
}
