import { ok } from '../../utils/respond.js';
import { createCheckout } from './checkout.service.js';

export async function create(req, res) {
  return ok(res, await createCheckout(req.user.id, req.body), { status: 201 });
}
