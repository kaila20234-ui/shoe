import { Router } from 'express';
import asyncHandler from '../../utils/asyncHandler.js';
import { list } from './delivery.controller.js';

const router = Router();
router.get('/', asyncHandler(list));

export default router;
