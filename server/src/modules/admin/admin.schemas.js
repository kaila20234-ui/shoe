import { z } from 'zod';
import { productInputSchema, productPatchSchema } from '../products/products.schemas.js';
import { zoneSchema } from '../delivery/delivery.schemas.js';
import { discountSchema, discountPatchSchema } from '../discounts/discounts.schemas.js';
import { statusChangeSchema, adminOrderQuerySchema } from '../orders/orders.schemas.js';
import { moderateReviewSchema } from '../reviews/reviews.schemas.js';
import { updateReturnSchema } from '../returns/returns.schemas.js';

export const adminProductCreateSchema = productInputSchema;
export const adminProductPatchSchema = productPatchSchema;
export const adminZoneSchema = zoneSchema;
export const adminDiscountSchema = discountSchema;
export const adminDiscountPatchSchema = discountPatchSchema;
export const adminOrderStatusSchema = statusChangeSchema;
export const adminReviewSchema = moderateReviewSchema;
export const adminReturnSchema = updateReturnSchema;
export const adminOrderListSchema = adminOrderQuerySchema;

export const stockSchema = z.object({
  sku: z.string().trim().min(1),
  stock: z.number().int().min(0),
});

export const lowStockQuerySchema = z.object({
  threshold: z.coerce.number().int().min(0).default(5),
});

export const reviewQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const returnQuerySchema = z.object({
  status: z.enum(['requested', 'approved', 'rejected', 'refunded']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const discountQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});
