import { z } from 'zod';

const addressFields = {
  label: z.string().trim().min(1).max(80),
  recipient: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(1).max(40),
  street: z.string().trim().min(1).max(240),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
  landmark: z.string().trim().max(200).optional(),
  isDefault: z.boolean(),
};

export const addressSchema = z.object(addressFields).strict();
export const addressPatchSchema = z.object(addressFields)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export const idParamsSchema = z.object({ id: z.string().min(1) }).strict();
export const customerStatusSchema = z.object({ isActive: z.boolean() }).strict();
export const customerListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(120).optional().default(''),
}).strict();
