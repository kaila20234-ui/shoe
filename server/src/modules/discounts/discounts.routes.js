import { Router } from 'express';
import { optionalAuthenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { validateDiscount } from './discounts.controller.js';
import { validateDiscountSchema } from './discounts.schemas.js';

const router = Router();
router.post('/validate', optionalAuthenticate, validate({ body: validateDiscountSchema }), asyncHandler(validateDiscount));

export default router;
