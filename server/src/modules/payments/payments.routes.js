import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { guestVerifySchema } from './payments.schemas.js';
import { verify, verifyGuest } from './payments.controller.js';
import { paystackWebhook } from './webhook.controller.js';

const router = Router();
router.get('/verify/:reference', authenticate, authorize('customer'), asyncHandler(verify));
router.post('/guest-verify/:reference', validate({ body: guestVerifySchema }), asyncHandler(verifyGuest));
router.post('/paystack/webhook', asyncHandler(paystackWebhook));

export default router;
