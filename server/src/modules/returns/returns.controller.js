import { ok } from '../../utils/respond.js';
import { createReturn, listCustomerReturns } from './returns.service.js';

export async function list(req, res) {
  return ok(res, await listCustomerReturns(req.user.id));
}

export async function create(req, res) {
  return ok(res, await createReturn(req.user.id, req.body), { status: 201 });
}
