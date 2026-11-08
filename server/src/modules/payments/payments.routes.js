import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { verify } from './payments.controller.js';
import { paystackWebhook } from './webhook.controller.js';

const router = Router();
router.get('/verify/:reference', authenticate, authorize('customer'), asyncHandler(verify));
router.post('/paystack/webhook', asyncHandler(paystackWebhook));

export default router;
