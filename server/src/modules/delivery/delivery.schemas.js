import { z } from 'zod';

export const zoneSchema = z.object({
  name: z.string().trim().min(1),
  states: z.array(z.string().trim().min(1)).min(1),
  fee: z.number().int().min(0),
  estimatedDays: z.string().trim().min(1),
  isActive: z.boolean().optional(),
});
