import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import asyncHandler from '../../utils/asyncHandler.js';
import * as controller from './users.controller.js';
import { adminCreateSchema, customerIdSchema, customerListSchema, customerStatusSchema } from './users.schemas.js';

const router = Router();
router.post('/admins', validate({ body: adminCreateSchema }), asyncHandler(controller.createAdmin));
router.get('/customers', validate({ query: customerListSchema }), asyncHandler(controller.listCustomers));
router.patch('/customers/:id/status', validate({ params: customerIdSchema, body: customerStatusSchema }), asyncHandler(controller.updateCustomerStatus));

export default router;
