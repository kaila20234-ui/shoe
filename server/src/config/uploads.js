import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const configDirectory = dirname(fileURLToPath(import.meta.url));

export const uploadsDirectory = resolve(configDirectory, '../../uploads');
