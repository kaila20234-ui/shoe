import { z } from 'zod';

const shippingAddressSchema = z.object({
  recipient: z.string().trim().min(1),
  phone: z.string().trim().min(1),
  street: z.string().trim().min(1),
  city: z.string().trim().min(1),
  state: z.string().trim().min(1),
  landmark: z.string().trim().optional(),
});

const guestDetailsSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
});

const checkoutItemSchema = z.object({
  productId: z.string().trim().min(1),
  sku: z.string().trim().min(1),
  quantity: z.number().int().min(1).max(100),
});

export const checkoutSchema = z.object({
  addressId: z.string().min(1).optional(),
  shippingAddress: shippingAddressSchema.optional(),
  guestDetails: guestDetailsSchema.optional(),
  items: z.array(checkoutItemSchema).min(1).max(50).optional(),
  deliveryZoneId: z.string().min(1),
  paymentMethod: z.enum(['paystack', 'pay_on_delivery']),
  discountCode: z.string().trim().min(1).transform((value) => value.toUpperCase()).optional(),
}).refine((value) => value.addressId || value.shippingAddress, {
  path: ['shippingAddress'],
  message: 'Provide a saved address or a shipping address',
});
