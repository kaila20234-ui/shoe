import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import asyncHandler from '../../utils/asyncHandler.js';
import * as controller from './cart.controller.js';
import { cartItemSchema } from './cart.schemas.js';

const router = Router();
router.use(authenticate, authorize('customer'));
router.get('/', asyncHandler(controller.get));
router.put('/items', validate({ body: cartItemSchema }), asyncHandler(controller.setItem));
router.delete('/', asyncHandler(controller.clear));

export default router;
