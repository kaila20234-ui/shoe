import { z } from 'zod';

const addressFieldsSchema = z.object({
  label: z.string().trim().min(1),
  recipient: z.string().trim().min(1),
  phone: z.string().trim().min(1),
  street: z.string().trim().min(1),
  city: z.string().trim().min(1),
  state: z.string().trim().min(1),
  landmark: z.string().trim().optional(),
  isDefault: z.boolean().optional(),
});

export const addressSchema = addressFieldsSchema;
export const addressPatchSchema = addressFieldsSchema.partial()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export const addressIdSchema = z.object({ id: z.string().min(1) });

export const customerListSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  q: z.string().optional(),
});

export const customerStatusSchema = z.object({ isActive: z.boolean() });
export const customerIdSchema = z.object({ id: z.string().min(1) });
