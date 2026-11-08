import { ok } from '../../utils/respond.js';
import { verifyForCustomer } from './payments.service.js';

export async function verify(req, res) {
  return ok(res, await verifyForCustomer(req.user.id, req.params.reference));
}
