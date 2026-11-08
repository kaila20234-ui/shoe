import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import asyncHandler from '../../utils/asyncHandler.js';
import * as controller from './users.controller.js';
import { addressIdSchema, addressPatchSchema, addressSchema } from './users.schemas.js';

const router = Router();
router.use(authenticate, authorize('customer'));
router.get('/me/addresses', asyncHandler(controller.listAddresses));
router.post('/me/addresses', validate({ body: addressSchema }), asyncHandler(controller.addAddress));
router.patch('/me/addresses/:id', validate({ params: addressIdSchema, body: addressPatchSchema }), asyncHandler(controller.updateAddress));
router.delete('/me/addresses/:id', validate({ params: addressIdSchema }), asyncHandler(controller.removeAddress));

export default router;
