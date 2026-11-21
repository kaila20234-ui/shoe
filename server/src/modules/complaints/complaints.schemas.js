import { z } from 'zod';

export const complaintReferenceSchema = z.object({
  reference: z.string().regex(/^CS-\d{8}-\d{5}$/),
});

export const createComplaintSchema = z.object({
  category: z.enum(['order', 'delivery', 'payment', 'product', 'account', 'other']),
  subject: z.string().trim().min(3).max(120),
  message: z.string().trim().min(10).max(5000),
  orderNumber: z.string().trim().max(40).optional(),
  contactName: z.string().trim().min(2).max(120).optional(),
  contactEmail: z.string().trim().email().max(254).transform((value) => value.toLowerCase()).optional(),
  contactPhone: z.string().trim().max(40).optional(),
});

export const complaintMessageSchema = z.object({
  content: z.string().trim().min(1).max(5000),
});

export const adminComplaintMessageSchema = complaintMessageSchema.extend({
  isInternal: z.boolean().default(false),
});

export const updateComplaintStatusSchema = z.object({
  status: z.enum(['in_review', 'awaiting_customer', 'resolved', 'closed']),
});

export const listComplaintsQuerySchema = z.object({
  status: z.enum(['submitted', 'in_review', 'awaiting_customer', 'resolved', 'closed']).optional(),
  category: z.enum(['order', 'delivery', 'payment', 'product', 'account', 'other']).optional(),
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});
