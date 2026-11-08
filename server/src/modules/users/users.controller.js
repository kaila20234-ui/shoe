import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/respond.js';
import * as usersService from './users.service.js';

export const listAddresses = asyncHandler(async (req, res) => {
  return ok(res, await usersService.listAddresses(req.user.id));
});

export const addAddress = asyncHandler(async (req, res) => {
  return ok(res, await usersService.addAddress(req.user, req.body), { status: 201 });
});

export const updateAddress = asyncHandler(async (req, res) => {
  return ok(res, await usersService.updateAddress(req.user, req.params.id, req.body));
});

export const deleteAddress = asyncHandler(async (req, res) => {
  await usersService.deleteAddress(req.user, req.params.id);
  return ok(res, {});
});

export const listCustomers = asyncHandler(async (req, res) => {
  const result = await usersService.listCustomers(req.query);
  return ok(res, result.data, { meta: result.meta });
});

export const setCustomerStatus = asyncHandler(async (req, res) => {
  const customer = await usersService.setCustomerStatus(req, req.params.id, req.body.isActive);
  return ok(res, customer);
});
