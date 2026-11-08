import { z } from 'zod';

const email = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
const password = z.string().min(8).max(128);

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email,
  password,
  phone: z.string().trim().max(40).optional(),
}).strict();

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(128),
}).strict();

export const forgotPasswordSchema = z.object({ email }).strict();
export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password,
}).strict();
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: password,
}).strict();
export const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().max(40).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one field is required');
