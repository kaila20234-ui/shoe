import { ok } from '../../utils/respond.js';
import { listActiveZones } from './delivery.service.js';

export async function list(_req, res) {
  return ok(res, await listActiveZones());
}
