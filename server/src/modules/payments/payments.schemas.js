import { z } from 'zod';

export const referenceSchema = z.object({ reference: z.string().trim().min(1) });
export const guestVerifySchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/i) });
