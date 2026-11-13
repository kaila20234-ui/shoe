import { z } from 'zod';

const variantSchema = z.object({
  sku: z.string().trim().min(1),
  size: z.number().positive(),
  color: z.string().trim().min(1),
  stock: z.number().int().min(0),
});

const productFieldsSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1),
  brand: z.string().trim().min(1).max(100),
  audience: z.enum(['men', 'women', 'kids']),
  type: z.enum(['sneakers', 'formal', 'sandals', 'boots', 'sports']),
  price: z.number().int().positive(),
  salePrice: z.number().int().positive().optional(),
  images: z.array(z.union([
    z.string().url(),
    z.string().regex(/^\/uploads\/products\/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\.(?:jpg|png|webp)$/i),
  ])).min(1),
  variants: z.array(variantSchema).min(1),
  isActive: z.boolean().optional(),
});

function validateProductFields(value, ctx) {
  if (value.salePrice !== undefined && value.salePrice >= value.price) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['salePrice'], message: 'salePrice must be below price' });
  }
  const skus = value.variants?.map(({ sku }) => sku);
  if (skus && new Set(skus).size !== skus.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['variants'], message: 'Variant SKUs must be unique' });
  }
}

export const productInputSchema = productFieldsSchema.superRefine(validateProductFields);
export const productPatchSchema = productFieldsSchema.partial()
  .superRefine(validateProductFields)
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export const productQuerySchema = z.object({
  q: z.string().optional(),
  audience: z.enum(['men', 'women', 'kids']).optional(),
  type: z.enum(['sneakers', 'formal', 'sandals', 'boots', 'sports']).optional(),
  brand: z.string().optional(),
  size: z.coerce.number().positive().optional(),
  color: z.string().optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'rating']).default('newest'),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});
