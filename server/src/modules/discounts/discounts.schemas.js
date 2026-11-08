import { z } from 'zod';

export const validateDiscountSchema = z.object({
  code: z.string().trim().min(1).transform((value) => value.toUpperCase()),
  subtotal: z.number().int().min(0).optional(),
});

const discountFieldsSchema = z.object({
  code: z.string().trim().min(1).transform((value) => value.toUpperCase()),
  type: z.enum(['percentage', 'fixed']),
  value: z.number().int().positive(),
  minSubtotal: z.number().int().min(0),
  maxUses: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
});

function validateDiscountFields(value, ctx) {
  if (value.type === 'percentage' && value.value > 100) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['value'], message: 'Percentage cannot exceed 100' });
  }
}

export const discountSchema = discountFieldsSchema.superRefine(validateDiscountFields);
export const discountPatchSchema = discountFieldsSchema.partial()
  .superRefine(validateDiscountFields)
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');
