import { Router } from 'express';
import { optionalAuthenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { create } from './checkout.controller.js';
import { checkoutSchema } from './checkout.schemas.js';

const router = Router();
router.post('/', optionalAuthenticate, validate({ body: checkoutSchema }), asyncHandler(create));

export default router;
