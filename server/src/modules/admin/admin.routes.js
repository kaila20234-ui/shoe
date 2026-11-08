import { Router } from 'express';
import multer from 'multer';
import ApiError from '../../utils/ApiError.js';
import { validate } from '../../middleware/validate.js';
import asyncHandler from '../../utils/asyncHandler.js';
import * as controller from './admin.controller.js';
import {
  adminProductCreateSchema, adminProductPatchSchema, adminZoneSchema, adminDiscountSchema,
  adminDiscountPatchSchema, adminOrderStatusSchema, adminReviewSchema, adminReturnSchema, adminOrderListSchema,
  stockSchema, lowStockQuerySchema, reviewQuerySchema, returnQuerySchema,
} from './admin.schemas.js';

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, callback) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      callback(new ApiError(400, 'VALIDATION_ERROR', 'Image must be jpg, png, or webp'));
      return;
    }
    callback(null, true);
  },
});

const router = Router();
router.get('/dashboard/summary', asyncHandler(controller.dashboard));
router.get('/products', asyncHandler(controller.listProducts));
router.post('/products', validate({ body: adminProductCreateSchema }), asyncHandler(controller.createProduct));
router.patch('/products/:id', validate({ body: adminProductPatchSchema }), asyncHandler(controller.updateProduct));
router.delete('/products/:id', asyncHandler(controller.deleteProduct));
router.patch('/products/:id/stock', validate({ body: stockSchema }), asyncHandler(controller.updateStock));
router.get('/inventory/low-stock', validate({ query: lowStockQuerySchema }), asyncHandler(controller.lowStock));
router.post('/uploads/image', imageUpload.single('image'), (req, _res, next) => {
  if (!req.file) return next(new ApiError(400, 'VALIDATION_ERROR', 'Image file is required'));
  return next();
}, asyncHandler(controller.uploadImage));
router.get('/orders', validate({ query: adminOrderListSchema }), asyncHandler(controller.listOrders));
router.get('/orders/:id', asyncHandler(controller.getOrder));
router.patch('/orders/:id/status', validate({ body: adminOrderStatusSchema }), asyncHandler(controller.changeOrderStatus));
router.get('/delivery-zones', asyncHandler(controller.listZones));
router.post('/delivery-zones', validate({ body: adminZoneSchema }), asyncHandler(controller.createZone));
router.patch('/delivery-zones/:id', validate({ body: adminZoneSchema.partial() }), asyncHandler(controller.updateZone));
router.delete('/delivery-zones/:id', asyncHandler(controller.deleteZone));
router.get('/discounts', asyncHandler(controller.listDiscounts));
router.post('/discounts', validate({ body: adminDiscountSchema }), asyncHandler(controller.createDiscount));
router.patch('/discounts/:id', validate({ body: adminDiscountPatchSchema }), asyncHandler(controller.updateDiscount));
router.delete('/discounts/:id', asyncHandler(controller.deleteDiscount));
router.get('/reviews', validate({ query: reviewQuerySchema }), asyncHandler(controller.listReviews));
router.patch('/reviews/:id', validate({ body: adminReviewSchema }), asyncHandler(controller.moderateReview));
router.get('/returns', validate({ query: returnQuerySchema }), asyncHandler(controller.listReturns));
router.patch('/returns/:id', validate({ body: adminReturnSchema }), asyncHandler(controller.updateReturn));

export default router;
