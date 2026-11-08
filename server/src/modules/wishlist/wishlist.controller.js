import { ok } from '../../utils/respond.js';
import * as service from './wishlist.service.js';

export async function list(req, res) {
  return ok(res, await service.listWishlist(req.user.id));
}

export async function add(req, res) {
  return ok(res, await service.addWishlistItem(req.user.id, req.params.productId));
}

export async function remove(req, res) {
  return ok(res, await service.removeWishlistItem(req.user.id, req.params.productId));
}
