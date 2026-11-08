import { ok } from '../../utils/respond.js';
import * as service from './cart.service.js';

export async function get(req, res) {
  return ok(res, await service.readCart(req.user.id));
}

export async function setItem(req, res) {
  return ok(res, await service.setCartItem(req.user.id, req.body));
}

export async function clear(req, res) {
  return ok(res, await service.emptyCart(req.user.id));
}
