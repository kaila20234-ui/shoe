import { ok } from '../../utils/respond.js';
import * as service from './orders.service.js';

export async function list(req, res) {
  const result = await service.listCustomerOrders(req.user.id, req.query);
  return ok(res, result.items, { meta: result.meta });
}

export async function detail(req, res) {
  return ok(res, await service.getCustomerOrder(req.user.id, req.params.id));
}

export async function cancel(req, res) {
  return ok(res, await service.cancelCustomerOrder(req.user.id, req.params.id));
}
