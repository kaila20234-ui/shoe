import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import asyncHandler from '../../utils/asyncHandler.js';
import * as controller from './products.controller.js';
import { productQuerySchema } from './products.schemas.js';

const router = Router();

router.get('/filters', asyncHandler(controller.filters));
router.get('/', validate({ query: productQuerySchema }), asyncHandler(controller.list));
router.get('/:id', asyncHandler(controller.detail));

export default router;
