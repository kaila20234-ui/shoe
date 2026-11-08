import { z } from 'zod';

const shippingAddressSchema = z.object({
  recipient: z.string().trim().min(1),
  phone: z.string().trim().min(1),
  street: z.string().trim().min(1),
  city: z.string().trim().min(1),
  state: z.string().trim().min(1),
  landmark: z.string().trim().optional(),
});

export const checkoutSchema = z.object({
  addressId: z.string().min(1).optional(),
  shippingAddress: shippingAddressSchema.optional(),
  deliveryZoneId: z.string().min(1),
  paymentMethod: z.enum(['paystack', 'pay_on_delivery']),
  discountCode: z.string().trim().min(1).transform((value) => value.toUpperCase()).optional(),
}).refine((value) => value.addressId || value.shippingAddress, {
  path: ['shippingAddress'],
  message: 'Provide a saved address or a shipping address',
});
