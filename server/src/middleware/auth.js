import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
import ApiError from '../utils/ApiError.js';

export async function authenticate(req, _res, next) {
  const header = req.get('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return next(new ApiError(401, 'UNAUTHENTICATED', 'Authentication is required'));
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload || typeof payload !== 'object' || typeof payload.sub !== 'string') {
      return next(new ApiError(401, 'UNAUTHENTICATED', 'Invalid authentication token'));
    }
    const user = await User.findById(payload.sub);
    if (!user) return next(new ApiError(401, 'UNAUTHENTICATED', 'User account no longer exists'));
    if (!user.isActive) return next(new ApiError(403, 'FORBIDDEN', 'This account is blocked'));
    req.user = user.toJSON();
    return next();
  } catch (error) {
    if (error instanceof ApiError) return next(error);
    return next(new ApiError(401, 'UNAUTHENTICATED', 'Invalid or expired authentication token'));
  }
}

export function authorize(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(new ApiError(401, 'UNAUTHENTICATED', 'Authentication is required'));
    if (!roles.includes(req.user.role)) return next(new ApiError(403, 'FORBIDDEN', 'You do not have permission to access this resource'));
    return next();
  };
}
