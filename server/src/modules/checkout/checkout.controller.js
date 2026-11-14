import { ok } from '../../utils/respond.js';
import ApiError from '../../utils/ApiError.js';
import { createCheckout } from './checkout.service.js';

export async function create(req, res) {
  if (req.user && req.user.role !== 'customer') {
    throw new ApiError(403, 'FORBIDDEN', 'Only customers can use a signed-in checkout');
  }
  return ok(res, await createCheckout(req.user?.id, req.body), { status: 201 });
}
