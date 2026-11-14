import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { rejectOwnerWrites } from '../../middleware/ownerReadOnly.js';
import { validate } from '../../middleware/validate.js';
import asyncHandler from '../../utils/asyncHandler.js';
import * as controller from './auth.controller.js';
import ApiError from '../../utils/ApiError.js';
import { createImageUpload } from '../../utils/imageUpload.js';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from './auth.schemas.js';

const router = Router();
const avatarUpload = createImageUpload('avatars');
router.post('/register', validate({ body: registerSchema }), asyncHandler(controller.register));
router.post('/login', validate({ body: loginSchema }), asyncHandler(controller.login));
router.post('/admin/login', validate({ body: loginSchema }), asyncHandler(controller.staffLogin));
router.post('/forgot-password', validate({ body: forgotPasswordSchema }), asyncHandler(controller.forgotPassword));
router.post('/reset-password', validate({ body: resetPasswordSchema }), asyncHandler(controller.resetPassword));
router.get('/me', authenticate, asyncHandler(controller.me));
router.post('/me/avatar', authenticate, avatarUpload.single('image'), (req, _res, next) => {
  if (!req.file) return next(new ApiError(400, 'VALIDATION_ERROR', 'Image file is required'));
  return next();
}, asyncHandler(controller.uploadAvatar));
router.patch('/me', authenticate, rejectOwnerWrites, validate({ body: updateProfileSchema }), asyncHandler(controller.updateProfile));
router.patch('/change-password', authenticate, rejectOwnerWrites, validate({ body: changePasswordSchema }), asyncHandler(controller.changePassword));

export default router;
