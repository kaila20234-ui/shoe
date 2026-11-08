import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import asyncHandler from '../../utils/asyncHandler.js';
import * as controller from './wishlist.controller.js';

const router = Router();
router.use(authenticate, authorize('customer'));
router.get('/', asyncHandler(controller.list));
router.post('/:productId', asyncHandler(controller.add));
router.delete('/:productId', asyncHandler(controller.remove));

export default router;
