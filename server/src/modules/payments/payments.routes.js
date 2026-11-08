import express from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { notImplemented } from '../../utils/notImplemented.js';

const router = express.Router();
router.get('/verify/:reference', authenticate, authorize('customer'), notImplemented);
router.post('/paystack/webhook', notImplemented);
export default router;
