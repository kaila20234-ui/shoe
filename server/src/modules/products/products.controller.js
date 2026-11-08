import { ok } from '../../utils/respond.js';
import * as service from './products.service.js';

export async function list(req, res) {
  const result = await service.listProducts(req.query);
  return ok(res, result.items, { meta: result.meta });
}

export async function filters(_req, res) {
  return ok(res, await service.getProductFilters());
}

export async function detail(req, res) {
  return ok(res, await service.getProduct(req.params.id));
}
