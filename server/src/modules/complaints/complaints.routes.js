import { Router } from 'express';
import { authenticate, authorize, optionalAuthenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import asyncHandler from '../../utils/asyncHandler.js';
import * as controller from './complaints.controller.js';
import {
  complaintMessageSchema,
  complaintReferenceSchema,
  createComplaintSchema,
  listComplaintsQuerySchema,
} from './complaints.schemas.js';

const router = Router();
router.post('/', optionalAuthenticate, validate({ body: createComplaintSchema }), asyncHandler(controller.create));
router.get('/guest/:reference', validate({ params: complaintReferenceSchema }), asyncHandler(controller.getGuest));
router.post(
  '/guest/:reference/messages',
  validate({ params: complaintReferenceSchema, body: complaintMessageSchema }),
  asyncHandler(controller.replyGuest),
);
router.use(authenticate, authorize('customer'));
router.get('/', validate({ query: listComplaintsQuerySchema }), asyncHandler(controller.listCustomer));
router.get('/:reference', validate({ params: complaintReferenceSchema }), asyncHandler(controller.getCustomer));
router.post(
  '/:reference/messages',
  validate({ params: complaintReferenceSchema, body: complaintMessageSchema }),
  asyncHandler(controller.replyCustomer),
);

export default router;
