import express from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { notImplemented } from '../../utils/notImplemented.js';

const router = express.Router();
router.get('/:id/reviews', notImplemented);
router.post('/:id/reviews', authenticate, authorize('customer'), notImplemented);
export default router;
