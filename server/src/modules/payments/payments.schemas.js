import { z } from 'zod';

export const referenceSchema = z.object({ reference: z.string().trim().min(1) });
