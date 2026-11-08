import ApiError from '../utils/ApiError.js';

const writeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function rejectOwnerWrites(req, _res, next) {
  if (req.user?.role === 'owner' && writeMethods.has(req.method)) {
    return next(new ApiError(403, 'FORBIDDEN', 'Owner access is read-only'));
  }
  return next();
}

export function readOnlyResource(req, _res, next) {
  if (writeMethods.has(req.method)) {
    return next(new ApiError(403, 'FORBIDDEN', 'This resource is read-only'));
  }
  return next();
}
