import { z } from 'zod';

export const orderListSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const adminOrderQuerySchema = orderListSchema.extend({
  status: z.enum(['pending_payment', 'paid', 'packed', 'shipped', 'delivered', 'cancelled', 'refunded']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  q: z.string().optional(),
});

export const statusChangeSchema = z.object({
  status: z.enum(['pending_payment', 'paid', 'packed', 'shipped', 'delivered', 'cancelled', 'refunded']),
  note: z.string().trim().max(1000).optional(),
});
