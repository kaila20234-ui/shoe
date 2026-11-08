import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/respond.js';
import * as authService from './auth.service.js';

export const register = asyncHandler(async (req, res) => {
  const data = await authService.register(req.body);
  return ok(res, data, { status: 201 });
});

export const login = asyncHandler(async (req, res) => {
  return ok(res, await authService.login(req.body));
});

export const forgotPassword = asyncHandler(async (req, res) => {
  await authService.forgotPassword(req.body.email);
  return ok(res, {});
});

export const resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.body);
  return ok(res, {});
});

export const me = asyncHandler(async (req, res) => ok(res, req.user));

export const updateMe = asyncHandler(async (req, res) => {
  Object.assign(req.user, req.body);
  await req.user.save();
  return ok(res, req.user);
});

export const changePassword = asyncHandler(async (req, res) => {
  await authService.changePassword(req.user.id, req.body);
  return ok(res, {});
});
