import { ok } from '../../utils/respond.js';
import { verifyForCustomer, verifyForGuest } from './payments.service.js';

export async function verify(req, res) {
  return ok(res, await verifyForCustomer(req.user.id, req.params.reference));
}

export async function verifyGuest(req, res) {
  return ok(res, await verifyForGuest(req.params.reference, req.body.token));
}
