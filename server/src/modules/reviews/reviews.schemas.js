import { z } from 'zod';

export const reviewInputSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().min(1).max(5000),
});

export const moderateReviewSchema = z.object({
  status: z.enum(['approved', 'rejected']),
});
