import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { validateDiscount } from './discounts.controller.js';
import { validateDiscountSchema } from './discounts.schemas.js';

const router = Router();
router.post('/validate', authenticate, authorize('customer'), validate({ body: validateDiscountSchema }), asyncHandler(validateDiscount));

export default router;
