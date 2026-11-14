import { Order } from '../../models/index.js';
import ApiError from '../../utils/ApiError.js';
import { logAudit } from '../../utils/audit.js';
import { ok } from '../../utils/respond.js';
import * as service from './admin.service.js';

async function audited(req, action, entity, entityId, meta) {
  await logAudit(req, { action, entity, entityId: String(entityId), meta });
}

export async function dashboard(_req, res) {
  return ok(res, await service.dashboardSummary());
}

export async function listProducts(req, res) {
  const result = await service.listAdminProducts(req.query);
  return ok(res, result.items, { meta: result.meta });
}

export async function createProduct(req, res) {
  const product = await service.createProduct(req.body);
  await audited(req, 'product.create', 'product', product.id);
  return ok(res, product, { status: 201 });
}

export async function updateProduct(req, res) {
  const product = await service.updateProduct(req.params.id, req.body);
  await audited(req, 'product.update', 'product', product.id);
  return ok(res, product);
}

export async function deleteProduct(req, res) {
  const product = await service.updateProduct(req.params.id, { isActive: false });
  await audited(req, 'product.delete', 'product', product.id);
  return ok(res, {});
}

export async function updateStock(req, res) {
  const product = await service.setStock(req.params.id, req.body.sku, req.body.stock);
  await audited(req, 'stock.update', 'product', product.id, { sku: req.body.sku, stock: req.body.stock });
  return ok(res, product);
}

export async function lowStock(req, res) {
  return ok(res, await service.lowStockList(req.query.threshold));
}

export async function uploadImage(req, res) {
  const url = `/uploads/products/${req.file.filename}`;
  await audited(req, 'image.upload', 'image', req.file.filename);
  return ok(res, { url });
}

export async function uploadModel(req, res) {
  const url = `/uploads/models/${req.file.filename}`;
  await audited(req, 'model.upload', 'model', req.file.filename);
  return ok(res, { url });
}

export async function listOrders(req, res) {
  const result = await service.listAdminOrders(req.query);
  return ok(res, result.items, { meta: result.meta });
}

export async function getOrder(req, res) {
  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, 'NOT_FOUND', 'Order not found');
  return ok(res, order);
}

export async function changeOrderStatus(req, res) {
  const order = await service.changeOrderStatus(req, req.params.id, req.body.status, req.body.note);
  return ok(res, order);
}

export async function listZones(_req, res) {
  return ok(res, await service.listZones());
}

export async function createZone(req, res) {
  const zone = await service.createZone(req.body);
  await audited(req, 'delivery_zone.create', 'delivery_zone', zone.id);
  return ok(res, zone, { status: 201 });
}

export async function updateZone(req, res) {
  const zone = await service.updateZone(req.params.id, req.body);
  await audited(req, 'delivery_zone.update', 'delivery_zone', zone.id);
  return ok(res, zone);
}

export async function deleteZone(req, res) {
  await service.removeZone(req.params.id);
  await audited(req, 'delivery_zone.delete', 'delivery_zone', req.params.id);
  return ok(res, {});
}

export async function listDiscounts(_req, res) {
  return ok(res, await service.listDiscounts());
}

export async function createDiscount(req, res) {
  const discount = await service.createDiscount(req.body);
  await audited(req, 'discount.create', 'discount', discount.id);
  return ok(res, discount, { status: 201 });
}

export async function updateDiscount(req, res) {
  const discount = await service.updateDiscount(req.params.id, req.body);
  await audited(req, 'discount.update', 'discount', discount.id);
  return ok(res, discount);
}

export async function deleteDiscount(req, res) {
  await service.removeDiscount(req.params.id);
  await audited(req, 'discount.delete', 'discount', req.params.id);
  return ok(res, {});
}

export async function listReviews(req, res) {
  const result = await service.listForModeration(req.query);
  return ok(res, result.items, { meta: result.meta });
}

export async function moderateReview(req, res) {
  const review = await service.moderateReview(req.params.id, req.body.status);
  await audited(req, 'review.moderate', 'review', review.id, { status: req.body.status });
  return ok(res, review);
}

export async function listReturns(req, res) {
  const result = await service.listAdminReturns(req.query);
  return ok(res, result.items, { meta: result.meta });
}

export async function updateReturn(req, res) {
  const returnRequest = await service.updateReturn(req.params.id, req.body.status, req.body.adminNote, req.user.id);
  await audited(req, 'return.update', 'return', returnRequest.id, { status: req.body.status });
  return ok(res, returnRequest);
}
