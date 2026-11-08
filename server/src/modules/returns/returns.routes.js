import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import asyncHandler from '../../utils/asyncHandler.js';
import * as controller from './returns.controller.js';
import { createReturnSchema } from './returns.schemas.js';

const router = Router();
router.use(authenticate, authorize('customer'));
router.get('/', asyncHandler(controller.list));
router.post('/', validate({ body: createReturnSchema }), asyncHandler(controller.create));

export default router;
