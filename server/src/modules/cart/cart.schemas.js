import { z } from 'zod';

export const cartItemSchema = z.object({
  productId: z.string().min(1),
  sku: z.string().trim().min(1),
  quantity: z.number().int().min(0),
});
