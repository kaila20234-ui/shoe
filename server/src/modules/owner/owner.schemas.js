import { z } from 'zod';

const date = z.string().datetime().optional();

export const transactionQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  from: date,
  to: date,
  status: z.enum(['pending', 'success', 'failed', 'refunded']).optional(),
  method: z.enum(['paystack', 'pay_on_delivery']).optional(),
  q: z.string().optional(),
});

export const transactionExportSchema = transactionQuerySchema.extend({
  format: z.literal('csv'),
});

export const reportQuerySchema = z.object({
  period: z.enum(['daily', 'weekly', 'monthly']),
  from: date,
  to: date,
});

export const topProductsQuerySchema = z.object({
  from: date,
  to: date,
  limit: z.coerce.number().int().positive().max(100).default(5),
});

export const auditQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  actorId: z.string().optional(),
  entity: z.string().optional(),
  from: date,
  to: date,
});
