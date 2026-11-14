import { ok } from '../../utils/respond.js';
import { validateForUser } from './discounts.service.js';

export async function validateDiscount(req, res) {
  const result = await validateForUser(req.user?.id, req.body.code, req.body.subtotal);
  return ok(res, result);
}
