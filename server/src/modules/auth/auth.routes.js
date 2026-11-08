import express from 'express';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './auth.controller.js';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from './auth.schemas.js';

const router = express.Router();

router.post('/register', validate({ body: registerSchema }), controller.register);
router.post('/login', validate({ body: loginSchema }), controller.login);
router.post('/forgot-password', validate({ body: forgotPasswordSchema }), controller.forgotPassword);
router.post('/reset-password', validate({ body: resetPasswordSchema }), controller.resetPassword);
router.get('/me', authenticate, controller.me);
router.patch('/me', authenticate, validate({ body: updateProfileSchema }), controller.updateMe);
router.patch('/change-password', authenticate, validate({ body: changePasswordSchema }), controller.changePassword);

export default router;
