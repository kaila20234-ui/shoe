import { ok } from '../../utils/respond.js';
import * as service from './reviews.service.js';

export async function list(req, res) {
  const result = await service.listApprovedReviews(req.params.id, req.query);
  return ok(res, result.items, { meta: result.meta });
}

export async function create(req, res) {
  return ok(res, await service.createReview(req.user, req.params.id, req.body), { status: 201 });
}
