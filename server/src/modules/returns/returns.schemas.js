import { z } from 'zod';

export const createReturnSchema = z.object({
  orderId: z.string().min(1),
  items: z.array(z.object({
    sku: z.string().trim().min(1),
    quantity: z.number().int().positive(),
  })).min(1),
  reason: z.string().trim().min(1).max(2000),
}).superRefine((value, ctx) => {
  if (new Set(value.items.map((item) => item.sku)).size !== value.items.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['items'], message: 'Each SKU may only appear once' });
  }
});

export const updateReturnSchema = z.object({
  status: z.enum(['approved', 'rejected', 'refunded']),
  adminNote: z.string().trim().max(2000).optional(),
});
