import ApiError from './ApiError.js';

export function parsePagination(query = {}) {
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? 20);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'page and limit must be positive integers; limit max is 100');
  }
  return { page, limit, skip: (page - 1) * limit };
}

export function buildMeta(page, limit, total) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}
