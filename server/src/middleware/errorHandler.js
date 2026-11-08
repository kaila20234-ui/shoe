import mongoose from 'mongoose';
import ApiError from '../utils/ApiError.js';

export function notFound(_req, _res, next) {
  next(new ApiError(404, 'NOT_FOUND', 'Route not found'));
}

export function errorHandler(error, _req, res, _next) {
  let status = 500;
  let code = 'INTERNAL';
  let message = 'An unexpected error occurred';
  let details;

  if (error instanceof ApiError) {
    status = error.status;
    code = error.code;
    message = error.message;
    details = error.details;
  } else if (error instanceof mongoose.Error.ValidationError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Request validation failed';
    details = Object.fromEntries(Object.entries(error.errors).map(([field, issue]) => [field, issue.message]));
  } else if (error?.code === 11000) {
    status = 409;
    code = 'CONFLICT';
    message = 'A record with this value already exists';
  } else if (error?.type === 'entity.parse.failed') {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Request body contains invalid JSON';
  } else {
    console.error(error);
  }

  return res.status(status).json({
    success: false,
    error: { code, message, ...(details ? { details } : {}) },
  });
}
