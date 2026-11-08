import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import asyncHandler from '../../utils/asyncHandler.js';
import * as controller from './reviews.controller.js';
import { reviewInputSchema } from './reviews.schemas.js';

const router = Router();
router.get('/:id/reviews', asyncHandler(controller.list));
router.post('/:id/reviews', authenticate, authorize('customer'), validate({ body: reviewInputSchema }), asyncHandler(controller.create));

export default router;
