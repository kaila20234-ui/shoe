import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
import { config } from '../config/env.js';
import ApiError from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const authenticate = asyncHandler(async (req, res, next) => {
  const authorization = req.get('authorization');
  const [scheme, token] = authorization?.split(' ') || [];
  if (scheme !== 'Bearer' || !token) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication is required');
  }

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Invalid or expired token');
  }
  if (typeof payload !== 'object' || typeof payload.sub !== 'string') {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Invalid or expired token');
  }

  const user = await User.findById(payload.sub);
  if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Invalid or expired token');
  if (!user.isActive) throw new ApiError(403, 'FORBIDDEN', 'This account is blocked');
  req.user = user;
  return next();
});

export function authorize(...roles) {
  return function authorizeRequest(req, res, next) {
    if (!req.user) return next(new ApiError(401, 'UNAUTHENTICATED', 'Authentication is required'));
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, 'FORBIDDEN', 'You do not have permission to access this resource'));
    }
    return next();
  };
}
