import mongoose from 'mongoose';
import ApiError from '../utils/ApiError.js';

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  let status = 500;
  let code = 'INTERNAL';
  let message = 'An unexpected error occurred';
  let details;

  if (error instanceof ApiError) {
    status = error.status;
    code = error.code;
    message = error.message;
    details = error.details;
  } else if (error?.name === 'ZodError') {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Request validation failed';
    details = {};
    for (const issue of error.issues) {
      details[issue.path.join('.') || 'request'] = issue.message;
    }
  } else if (error instanceof mongoose.Error.ValidationError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Request validation failed';
    details = Object.fromEntries(
      Object.entries(error.errors).map(([field, issue]) => [field, issue.message]),
    );
  } else if (error?.code === 11000) {
    status = 409;
    code = 'CONFLICT';
    message = 'A record with this value already exists';
    const field = Object.keys(error.keyPattern || {})[0];
    if (field) details = { [field]: `${field} already exists` };
  } else {
    console.error('Unhandled request error:', error);
  }

  return res.status(status).json({
    success: false,
    error: { code, message, ...(details ? { details } : {}) },
  });
}
