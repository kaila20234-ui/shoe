import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import asyncHandler from '../../utils/asyncHandler.js';
import * as controller from './orders.controller.js';
import { orderListSchema } from './orders.schemas.js';

const router = Router();
router.use(authenticate, authorize('customer'));
router.get('/', validate({ query: orderListSchema }), asyncHandler(controller.list));
router.get('/:id', asyncHandler(controller.detail));
router.post('/:id/cancel', asyncHandler(controller.cancel));

export default router;
