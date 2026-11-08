import express from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './users.controller.js';
import {
  addressPatchSchema,
  addressSchema,
  customerListSchema,
  customerStatusSchema,
  idParamsSchema,
} from './users.schemas.js';

const router = express.Router();

router.get('/users/me/addresses', authenticate, authorize('customer'), controller.listAddresses);
router.post('/users/me/addresses', authenticate, authorize('customer'), validate({ body: addressSchema }), controller.addAddress);
router.patch(
  '/users/me/addresses/:id',
  authenticate,
  authorize('customer'),
  validate({ params: idParamsSchema, body: addressPatchSchema }),
  controller.updateAddress,
);
router.delete(
  '/users/me/addresses/:id',
  authenticate,
  authorize('customer'),
  validate({ params: idParamsSchema }),
  controller.deleteAddress,
);
router.get(
  '/admin/customers',
  validate({ query: customerListSchema }),
  controller.listCustomers,
);
router.patch(
  '/admin/customers/:id/status',
  validate({ params: idParamsSchema, body: customerStatusSchema }),
  controller.setCustomerStatus,
);

export default router;
